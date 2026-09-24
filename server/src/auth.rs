use axum::{
    extract::State,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use serde::Serialize;
use sqlx::Row;
use uuid::Uuid;

use crate::{
    error::ApiError,
    models::{Credentials, PasswordInput, ProfileInput, PublicUser, RegisterInput, UserRecord},
    security::{
        constant_time_value_matches, hash_password, normalize_email, random_token, token_hash,
        validate_display_name, validate_password, verify_password, SESSION_COOKIE,
    },
    state::AppState,
};

const MAX_FAILED_LOGINS: i64 = 5;
const LOCK_SECONDS: i64 = 15 * 60;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapResponse {
    pub has_accounts: bool,
    pub registration_enabled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionResponse {
    pub user: PublicUser,
    pub csrf_token: String,
}

#[derive(Clone)]
pub struct Authenticated {
    pub user: UserRecord,
    pub session_hash: String,
    csrf_token: String,
}

pub async fn bootstrap(State(state): State<AppState>) -> Result<Json<BootstrapResponse>, ApiError> {
    let has_accounts = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(&state.pool)
        .await?
        > 0;
    let registration_enabled =
        !has_accounts || setting_enabled(&state, "registration_enabled").await?;
    Ok(Json(BootstrapResponse {
        has_accounts,
        registration_enabled,
    }))
}

pub async fn register(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<RegisterInput>,
) -> Result<Response, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let email = normalize_email(&body.email)?;
    let display_name = validate_display_name(&body.display_name)?;
    validate_password(&body.password, &email)?;
    let password_hash = hash_password(body.password).await?;
    let now = Utc::now().timestamp();

    let mut transaction = state.pool.begin().await?;
    let first_account = sqlx::query(
        "UPDATE settings SET value = 'true' WHERE key = 'bootstrap_claimed' AND value = 'false'",
    )
    .execute(&mut *transaction)
    .await?
    .rows_affected()
        == 1;

    if !first_account {
        let enabled = sqlx::query_scalar::<_, String>(
            "SELECT value FROM settings WHERE key = 'registration_enabled'",
        )
        .fetch_one(&mut *transaction)
        .await?
            == "true";
        if !enabled {
            transaction.rollback().await?;
            return Err(ApiError::forbidden("L’inscription libre est désactivée."));
        }
    }

    let id = Uuid::new_v4().to_string();
    let role = if first_account { "admin" } else { "member" };
    let inserted = sqlx::query(
        "INSERT INTO users(id, email, display_name, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
    )
    .bind(&id)
    .bind(&email)
    .bind(&display_name)
    .bind(&password_hash)
    .bind(role)
    .bind(now)
    .bind(now)
    .execute(&mut *transaction)
    .await;
    if let Err(error) = inserted {
        transaction.rollback().await?;
        if is_unique_violation(&error) {
            return Err(ApiError::conflict(
                "email_exists",
                "Un compte utilise déjà cette adresse e-mail.",
            ));
        }
        return Err(error.into());
    }
    transaction.commit().await?;

    let user = find_user_by_id(&state, &id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    create_session_response(&state, user).await
}

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Credentials>,
) -> Result<Response, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let email = normalize_email(&body.email)?;
    let user = find_user_by_email(&state, &email).await?;
    let hash = user
        .as_ref()
        .map(|value| value.password_hash.clone())
        .unwrap_or_else(|| (*state.dummy_password_hash).clone());
    let password_valid = verify_password(body.password, hash).await;
    let now = Utc::now().timestamp();

    let Some(mut user) = user else {
        return Err(invalid_credentials());
    };
    if !password_valid || !user.is_active || user.locked_until.is_some_and(|until| until > now) {
        if user.is_active && user.locked_until.is_none_or(|until| until <= now) {
            let attempts = user.failed_login_attempts + 1;
            if attempts >= MAX_FAILED_LOGINS {
                sqlx::query("UPDATE users SET failed_login_attempts = 0, locked_until = ?, updated_at = ? WHERE id = ?")
                    .bind(now + LOCK_SECONDS).bind(now).bind(&user.id).execute(&state.pool).await?;
            } else {
                sqlx::query("UPDATE users SET failed_login_attempts = ?, locked_until = NULL, updated_at = ? WHERE id = ?")
                    .bind(attempts).bind(now).bind(&user.id).execute(&state.pool).await?;
            }
        }
        return Err(invalid_credentials());
    }

    sqlx::query("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?")
        .bind(now).bind(now).bind(&user.id).execute(&state.pool).await?;
    user.failed_login_attempts = 0;
    user.locked_until = None;
    user.last_login_at = Some(now);
    create_session_response(&state, user).await
}

pub async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<SessionResponse>, ApiError> {
    let authenticated = authenticate(&state, &headers).await?;
    Ok(Json(SessionResponse {
        user: authenticated.user.into(),
        csrf_token: authenticated.csrf_token,
    }))
}

pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let authenticated = authenticate_mutation(&state, &headers).await?;
    sqlx::query("DELETE FROM sessions WHERE token_hash = ?")
        .bind(authenticated.session_hash)
        .execute(&state.pool)
        .await?;
    let mut response = StatusCode::NO_CONTENT.into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, clear_cookie(&state)?);
    Ok(response)
}

pub async fn update_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ProfileInput>,
) -> Result<Json<SessionResponse>, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let authenticated = authenticate_mutation(&state, &headers).await?;
    let display_name = validate_display_name(&body.display_name)?;
    let now = Utc::now().timestamp();
    sqlx::query("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?")
        .bind(display_name)
        .bind(now)
        .bind(&authenticated.user.id)
        .execute(&state.pool)
        .await?;
    let user = find_user_by_id(&state, &authenticated.user.id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(SessionResponse {
        user: user.into(),
        csrf_token: authenticated.csrf_token,
    }))
}

pub async fn change_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<PasswordInput>,
) -> Result<Json<SessionResponse>, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let authenticated = authenticate_mutation(&state, &headers).await?;
    let valid = verify_password(
        body.current_password,
        authenticated.user.password_hash.clone(),
    )
    .await;
    if !valid {
        return Err(ApiError::bad_request(
            "invalid_current_password",
            "Le mot de passe actuel est incorrect.",
            Some("currentPassword"),
        ));
    }
    validate_password(&body.new_password, &authenticated.user.email)?;
    let password_hash = hash_password(body.new_password).await?;
    let now = Utc::now().timestamp();
    let mut transaction = state.pool.begin().await?;
    sqlx::query("UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?")
        .bind(password_hash).bind(now).bind(&authenticated.user.id).execute(&mut *transaction).await?;
    sqlx::query("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?")
        .bind(&authenticated.user.id)
        .bind(&authenticated.session_hash)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    let user = find_user_by_id(&state, &authenticated.user.id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(SessionResponse {
        user: user.into(),
        csrf_token: authenticated.csrf_token,
    }))
}

pub async fn authenticate(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<Authenticated, ApiError> {
    let token = cookie_value(headers, SESSION_COOKIE).ok_or_else(ApiError::unauthorized)?;
    let session_hash = token_hash(&token);
    let now = Utc::now().timestamp();
    let row = sqlx::query(
        r#"SELECT u.id, u.email, u.display_name, u.password_hash, u.role, u.is_active,
                  u.failed_login_attempts, u.locked_until, u.last_login_at, u.created_at,
                  s.csrf_token
           FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1"#,
    )
    .bind(&session_hash)
    .bind(now)
    .fetch_optional(&state.pool)
    .await?;
    let Some(row) = row else {
        return Err(ApiError::unauthorized());
    };
    sqlx::query("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?")
        .bind(now)
        .bind(&session_hash)
        .execute(&state.pool)
        .await?;
    Ok(Authenticated {
        user: UserRecord {
            id: row.try_get("id")?,
            email: row.try_get("email")?,
            display_name: row.try_get("display_name")?,
            password_hash: row.try_get("password_hash")?,
            role: row.try_get("role")?,
            is_active: row.try_get("is_active")?,
            failed_login_attempts: row.try_get("failed_login_attempts")?,
            locked_until: row.try_get("locked_until")?,
            last_login_at: row.try_get("last_login_at")?,
            created_at: row.try_get("created_at")?,
        },
        session_hash,
        csrf_token: row.try_get("csrf_token")?,
    })
}

pub async fn authenticate_mutation(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<Authenticated, ApiError> {
    let authenticated = authenticate(state, headers).await?;
    let csrf = headers
        .get("x-csrf-token")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if csrf.is_empty() || !constant_time_value_matches(&authenticated.csrf_token, csrf) {
        return Err(ApiError::forbidden(
            "Jeton de sécurité invalide. Rechargez la page.",
        ));
    }
    Ok(authenticated)
}

pub fn require_admin(authenticated: &Authenticated) -> Result<(), ApiError> {
    if authenticated.user.role != "admin" {
        return Err(ApiError::forbidden("Droits administrateur requis."));
    }
    Ok(())
}

pub fn require_allowed_origin(state: &AppState, headers: &HeaderMap) -> Result<(), ApiError> {
    let Some(origin) = headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
    else {
        return Ok(());
    };
    if state
        .config
        .allowed_origins
        .iter()
        .any(|allowed| allowed == origin)
        || origin_matches_host(origin, headers)
    {
        return Ok(());
    }
    Err(ApiError::forbidden("Origine de requête non autorisée."))
}

async fn create_session_response(state: &AppState, user: UserRecord) -> Result<Response, ApiError> {
    let token = random_token();
    let csrf_token = random_token();
    let now = Utc::now().timestamp();
    sqlx::query("DELETE FROM sessions WHERE expires_at <= ?")
        .bind(now)
        .execute(&state.pool)
        .await?;
    sqlx::query("INSERT INTO sessions(token_hash, user_id, csrf_token, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(token_hash(&token)).bind(&user.id).bind(&csrf_token).bind(now)
        .bind(now + state.config.session_lifetime_seconds).bind(now).execute(&state.pool).await?;
    let body = Json(SessionResponse {
        user: user.into(),
        csrf_token,
    });
    let mut response = (StatusCode::OK, body).into_response();
    response
        .headers_mut()
        .insert(header::SET_COOKIE, session_cookie(state, &token)?);
    Ok(response)
}

fn session_cookie(state: &AppState, token: &str) -> Result<HeaderValue, ApiError> {
    let secure = if state.config.cookie_secure {
        "; Secure"
    } else {
        ""
    };
    HeaderValue::from_str(&format!(
        "{SESSION_COOKIE}={token}; Path=/api; HttpOnly; SameSite=Lax; Max-Age={}{}",
        state.config.session_lifetime_seconds, secure,
    ))
    .map_err(|error| ApiError::Internal(format!("invalid session cookie: {error}")))
}

fn clear_cookie(state: &AppState) -> Result<HeaderValue, ApiError> {
    let secure = if state.config.cookie_secure {
        "; Secure"
    } else {
        ""
    };
    HeaderValue::from_str(&format!(
        "{SESSION_COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0{secure}"
    ))
    .map_err(|error| ApiError::Internal(format!("invalid clear cookie: {error}")))
}

fn cookie_value(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .find_map(|part| {
            let (key, value) = part.trim().split_once('=')?;
            (key == name && !value.is_empty()).then(|| value.to_owned())
        })
}

fn origin_matches_host(origin: &str, headers: &HeaderMap) -> bool {
    let origin_authority = origin
        .split_once("://")
        .map(|(_, authority)| authority)
        .unwrap_or(origin)
        .trim_end_matches('/');
    let request_host = headers
        .get("x-forwarded-host")
        .or_else(|| headers.get(header::HOST))
        .and_then(|value| value.to_str().ok());
    request_host.is_some_and(|host| host.eq_ignore_ascii_case(origin_authority))
}

fn invalid_credentials() -> ApiError {
    ApiError::Client {
        status: StatusCode::UNAUTHORIZED,
        code: "invalid_credentials",
        message: "Adresse e-mail ou mot de passe incorrect.".into(),
        field: None,
    }
}

pub async fn find_user_by_id(state: &AppState, id: &str) -> Result<Option<UserRecord>, ApiError> {
    Ok(sqlx::query_as::<_, UserRecord>("SELECT id, email, display_name, password_hash, role, is_active, failed_login_attempts, locked_until, last_login_at, created_at FROM users WHERE id = ?")
        .bind(id).fetch_optional(&state.pool).await?)
}

async fn find_user_by_email(state: &AppState, email: &str) -> Result<Option<UserRecord>, ApiError> {
    Ok(sqlx::query_as::<_, UserRecord>("SELECT id, email, display_name, password_hash, role, is_active, failed_login_attempts, locked_until, last_login_at, created_at FROM users WHERE email = ?")
        .bind(email).fetch_optional(&state.pool).await?)
}

async fn setting_enabled(state: &AppState, key: &str) -> Result<bool, ApiError> {
    Ok(
        sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
            .bind(key)
            .fetch_one(&state.pool)
            .await?
            == "true",
    )
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    matches!(error, sqlx::Error::Database(database) if database.is_unique_violation())
}
