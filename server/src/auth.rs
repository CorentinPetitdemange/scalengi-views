use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    Json,
};
use axum_login::AuthSession;
use chrono::Utc;
use serde::Serialize;
use uuid::Uuid;

use crate::{
    backend::{find_user_by_id, AuthBackend},
    error::ApiError,
    models::{Credentials, PasswordInput, ProfileInput, PublicUser, RegisterInput, UserRecord},
    oidc::PublicOidcConfig,
    security::{
        constant_time_value_matches, hash_password, normalize_email, random_token,
        validate_display_name, validate_password, verify_password,
    },
    state::AppState,
};

const CSRF_SESSION_KEY: &str = "csrf_token";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapResponse {
    pub has_accounts: bool,
    pub registration_enabled: bool,
    pub installation_profile: crate::config::InstallationProfile,
    pub oidc: PublicOidcConfig,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionResponse {
    pub user: PublicUser,
    pub csrf_token: String,
    pub installation_profile: crate::config::InstallationProfile,
}

pub async fn bootstrap(State(state): State<AppState>) -> Result<Json<BootstrapResponse>, ApiError> {
    let has_accounts = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(&state.pool)
        .await?
        > 0;
    let registration_enabled = local_login_enabled(&state).await
        && (!has_accounts || setting_enabled(&state, "registration_enabled").await?);
    Ok(Json(BootstrapResponse {
        has_accounts,
        registration_enabled,
        installation_profile: state.config.installation_profile,
        oidc: PublicOidcConfig::from_state(&state).await,
    }))
}

pub async fn register(
    State(state): State<AppState>,
    mut auth_session: AuthSession<AuthBackend>,
    headers: HeaderMap,
    Json(body): Json<RegisterInput>,
) -> Result<Json<SessionResponse>, ApiError> {
    require_allowed_origin(&state, &headers)?;
    if !local_login_enabled(&state).await {
        return Err(ApiError::forbidden(
            "La création de comptes locaux est désactivée.",
        ));
    }
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
    let inserted = sqlx::query("INSERT INTO users(id, email, display_name, password_hash, auth_provider, session_version, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 'local', ?, ?, 1, ?, ?)")
        .bind(&id).bind(&email).bind(&display_name).bind(&password_hash).bind(random_token())
        .bind(role).bind(now).bind(now).execute(&mut *transaction).await;
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
    let user = find_user_by_id(&state.pool, &id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    if auth_session.user.is_some() {
        auth_session
            .session
            .cycle_id()
            .await
            .map_err(session_error)?;
    }
    auth_session.login(&user).await.map_err(auth_error)?;
    session_response(&state, &auth_session, user).await
}

pub async fn login(
    State(state): State<AppState>,
    mut auth_session: AuthSession<AuthBackend>,
    headers: HeaderMap,
    Json(body): Json<Credentials>,
) -> Result<Json<SessionResponse>, ApiError> {
    require_allowed_origin(&state, &headers)?;
    if !local_login_enabled(&state).await {
        return Err(invalid_credentials());
    }
    let user = auth_session
        .authenticate(body)
        .await
        .map_err(auth_error)?
        .ok_or_else(invalid_credentials)?;
    if auth_session.user.is_some() {
        auth_session
            .session
            .cycle_id()
            .await
            .map_err(session_error)?;
    }
    auth_session.login(&user).await.map_err(auth_error)?;
    session_response(&state, &auth_session, user).await
}

pub async fn me(
    State(state): State<AppState>,
    auth_session: AuthSession<AuthBackend>,
) -> Result<Json<SessionResponse>, ApiError> {
    let user = authenticated_user(&auth_session)?;
    session_response(&state, &auth_session, user).await
}

pub async fn logout(
    State(state): State<AppState>,
    mut auth_session: AuthSession<AuthBackend>,
    headers: HeaderMap,
) -> Result<StatusCode, ApiError> {
    require_allowed_origin(&state, &headers)?;
    authenticate_mutation(&auth_session, &headers).await?;
    auth_session.logout().await.map_err(auth_error)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_profile(
    State(state): State<AppState>,
    auth_session: AuthSession<AuthBackend>,
    headers: HeaderMap,
    Json(body): Json<ProfileInput>,
) -> Result<Json<SessionResponse>, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let current = authenticate_mutation(&auth_session, &headers).await?;
    let display_name = validate_display_name(&body.display_name)?;
    let now = Utc::now().timestamp();
    sqlx::query("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?")
        .bind(display_name)
        .bind(now)
        .bind(&current.id)
        .execute(&state.pool)
        .await?;
    let user = find_user_by_id(&state.pool, &current.id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    session_response(&state, &auth_session, user).await
}

pub async fn change_password(
    State(state): State<AppState>,
    mut auth_session: AuthSession<AuthBackend>,
    headers: HeaderMap,
    Json(body): Json<PasswordInput>,
) -> Result<Json<SessionResponse>, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let current = authenticate_mutation(&auth_session, &headers).await?;
    if !matches!(current.auth_provider.as_str(), "local" | "both")
        || current.password_hash.is_empty()
    {
        return Err(ApiError::bad_request(
            "sso_managed_password",
            "Ce compte est géré par le fournisseur SSO.",
            None,
        ));
    }
    if !verify_password(body.current_password, current.password_hash.clone()).await {
        return Err(ApiError::bad_request(
            "invalid_current_password",
            "Le mot de passe actuel est incorrect.",
            Some("currentPassword"),
        ));
    }
    validate_password(&body.new_password, &current.email)?;
    let password_hash = hash_password(body.new_password).await?;
    let now = Utc::now().timestamp();
    sqlx::query("UPDATE users SET password_hash = ?, session_version = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?")
        .bind(password_hash).bind(random_token()).bind(now).bind(&current.id)
        .execute(&state.pool).await?;
    let user = find_user_by_id(&state.pool, &current.id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    // Rotate the current identifier too; all other sessions fail their auth-hash check.
    auth_session
        .session
        .cycle_id()
        .await
        .map_err(session_error)?;
    auth_session.login(&user).await.map_err(auth_error)?;
    session_response(&state, &auth_session, user).await
}

pub async fn authenticate_mutation(
    auth_session: &AuthSession<AuthBackend>,
    headers: &HeaderMap,
) -> Result<UserRecord, ApiError> {
    let user = authenticated_user(auth_session)?;
    let expected = auth_session
        .session
        .get::<String>(CSRF_SESSION_KEY)
        .await
        .map_err(session_error)?
        .ok_or_else(ApiError::unauthorized)?;
    let supplied = headers
        .get("x-csrf-token")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if supplied.is_empty() || !constant_time_value_matches(&expected, supplied) {
        return Err(ApiError::forbidden(
            "Jeton de sécurité invalide. Rechargez la page.",
        ));
    }
    Ok(user)
}

pub fn authenticated_user(auth_session: &AuthSession<AuthBackend>) -> Result<UserRecord, ApiError> {
    auth_session.user.clone().ok_or_else(ApiError::unauthorized)
}

pub fn require_admin(user: &UserRecord) -> Result<(), ApiError> {
    if user.role != "admin" {
        return Err(ApiError::forbidden("Droits administrateur requis."));
    }
    Ok(())
}

pub async fn ensure_csrf_token(
    auth_session: &AuthSession<AuthBackend>,
) -> Result<String, ApiError> {
    if let Some(token) = auth_session
        .session
        .get::<String>(CSRF_SESSION_KEY)
        .await
        .map_err(session_error)?
    {
        return Ok(token);
    }
    let token = random_token();
    auth_session
        .session
        .insert(CSRF_SESSION_KEY, token.clone())
        .await
        .map_err(session_error)?;
    Ok(token)
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
    {
        return Ok(());
    }
    Err(ApiError::forbidden("Origine de requête non autorisée."))
}

async fn session_response(
    state: &AppState,
    auth_session: &AuthSession<AuthBackend>,
    user: UserRecord,
) -> Result<Json<SessionResponse>, ApiError> {
    Ok(Json(SessionResponse {
        user: user.into(),
        csrf_token: ensure_csrf_token(auth_session).await?,
        installation_profile: state.config.installation_profile,
    }))
}

async fn local_login_enabled(state: &AppState) -> bool {
    state
        .oidc_service()
        .await
        .is_none_or(|service| service.config.local_login_enabled)
}

fn invalid_credentials() -> ApiError {
    ApiError::Client {
        status: StatusCode::UNAUTHORIZED,
        code: "invalid_credentials",
        message: "Adresse e-mail ou mot de passe incorrect.".into(),
        field: None,
    }
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

fn session_error(error: tower_sessions::session::Error) -> ApiError {
    ApiError::Internal(format!("session: {error}"))
}

fn auth_error(error: axum_login::Error<AuthBackend>) -> ApiError {
    ApiError::Internal(format!("authentication session: {error}"))
}
