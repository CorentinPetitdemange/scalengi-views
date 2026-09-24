use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use axum_login::AuthSession;
use chrono::Utc;
use serde::Serialize;
use uuid::Uuid;

use crate::{
    auth::{authenticate_mutation, authenticated_user, require_admin, require_allowed_origin},
    backend::{find_user_by_id, AuthBackend},
    error::ApiError,
    models::{
        AdminCreateUserInput, AdminUpdateUserInput, PublicUser, RegistrationSettingInput,
        UserRecord, USER_COLUMNS,
    },
    security::{
        hash_password, normalize_email, random_token, validate_auth_provider,
        validate_display_name, validate_password, validate_role,
    },
    state::AppState,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsersResponse {
    users: Vec<PublicUser>,
}

#[derive(Serialize)]
pub struct RegistrationResponse {
    enabled: bool,
}

pub async fn list_users(
    State(state): State<AppState>,
    auth_session: AuthSession<AuthBackend>,
) -> Result<Json<UsersResponse>, ApiError> {
    let user = authenticated_user(&auth_session)?;
    require_admin(&user)?;
    let query =
        format!("SELECT {USER_COLUMNS} FROM users ORDER BY display_name COLLATE NOCASE, email");
    let users = sqlx::query_as::<_, UserRecord>(&query)
        .fetch_all(&state.pool)
        .await?
        .into_iter()
        .map(PublicUser::from)
        .collect();
    Ok(Json(UsersResponse { users }))
}

pub async fn create_user(
    State(state): State<AppState>,
    auth_session: AuthSession<AuthBackend>,
    headers: HeaderMap,
    Json(body): Json<AdminCreateUserInput>,
) -> Result<(StatusCode, Json<PublicUser>), ApiError> {
    require_allowed_origin(&state, &headers)?;
    let actor = authenticate_mutation(&auth_session, &headers).await?;
    require_admin(&actor)?;
    let email = normalize_email(&body.email)?;
    let display_name = validate_display_name(&body.display_name)?;
    let auth_provider =
        validate_auth_provider(&body.auth_provider, state.oidc.is_some())?.to_owned();
    let role = validate_role(&body.role)?.to_owned();
    let password_hash = password_for_provider(body.password, &email, &auth_provider).await?;
    let now = Utc::now().timestamp();
    let user = UserRecord {
        id: Uuid::new_v4().to_string(),
        email,
        display_name,
        password_hash,
        auth_provider,
        session_version: random_token(),
        role,
        is_active: true,
        failed_login_attempts: 0,
        locked_until: None,
        last_login_at: None,
        created_at: now,
    };
    let result = sqlx::query("INSERT INTO users(id, email, display_name, password_hash, auth_provider, session_version, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
        .bind(&user.id).bind(&user.email).bind(&user.display_name).bind(&user.password_hash)
        .bind(&user.auth_provider).bind(&user.session_version).bind(&user.role).bind(now).bind(now)
        .execute(&state.pool).await;
    if let Err(error) = result {
        if matches!(&error, sqlx::Error::Database(database) if database.is_unique_violation()) {
            return Err(ApiError::conflict(
                "email_exists",
                "Un compte utilise déjà cette adresse e-mail.",
            ));
        }
        return Err(error.into());
    }
    Ok((StatusCode::CREATED, Json(user.into())))
}

pub async fn update_user(
    State(state): State<AppState>,
    Path(id): Path<String>,
    auth_session: AuthSession<AuthBackend>,
    headers: HeaderMap,
    Json(body): Json<AdminUpdateUserInput>,
) -> Result<Json<PublicUser>, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let actor = authenticate_mutation(&auth_session, &headers).await?;
    require_admin(&actor)?;
    let current = find_user_by_id(&state.pool, &id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    if actor.id == id
        && body
            .password
            .as_ref()
            .is_some_and(|password| !password.is_empty())
    {
        return Err(ApiError::forbidden(
            "Utilisez Mon compte et confirmez votre mot de passe actuel.",
        ));
    }
    if actor.id == id
        && (body.role.as_deref().is_some_and(|role| role != "admin")
            || body.is_active == Some(false)
            || body
                .auth_provider
                .as_deref()
                .is_some_and(|provider| provider != current.auth_provider))
    {
        return Err(ApiError::forbidden("Vous ne pouvez pas retirer vos propres droits, désactiver votre compte ou modifier votre méthode de connexion."));
    }
    let next_name = match body.display_name {
        Some(value) => validate_display_name(&value)?,
        None => current.display_name.clone(),
    };
    let next_role = match body.role {
        Some(value) => validate_role(&value)?.to_owned(),
        None => current.role.clone(),
    };
    let next_provider = match body.auth_provider {
        Some(value) => validate_auth_provider(&value, state.oidc.is_some())?.to_owned(),
        None => current.auth_provider.clone(),
    };
    let new_password = body.password.filter(|value| !value.is_empty());
    let next_password = if next_provider == "oidc" {
        String::new()
    } else if let Some(password) = new_password.as_ref() {
        validate_password(password, &current.email)?;
        hash_password(password.clone()).await?
    } else {
        current.password_hash.clone()
    };
    if matches!(next_provider.as_str(), "local" | "both") && next_password.is_empty() {
        return Err(ApiError::bad_request(
            "password_required",
            "Un mot de passe est requis pour activer la connexion locale.",
            Some("password"),
        ));
    }
    let next_active = body.is_active.unwrap_or(current.is_active);
    let would_remove_admin =
        current.role == "admin" && current.is_active && (next_role != "admin" || !next_active);
    let session_sensitive_change = next_active != current.is_active
        || next_role != current.role
        || next_provider != current.auth_provider
        || new_password.is_some();
    let next_session_version = if session_sensitive_change {
        random_token()
    } else {
        current.session_version.clone()
    };
    let now = Utc::now().timestamp();
    let updated = sqlx::query("UPDATE users SET display_name = ?, role = ?, is_active = ?, password_hash = ?, auth_provider = ?, session_version = ?, failed_login_attempts = CASE WHEN ? THEN 0 ELSE failed_login_attempts END, locked_until = CASE WHEN ? THEN NULL ELSE locked_until END, updated_at = ? WHERE id = ? AND (? = 0 OR (SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1) > 1)")
        .bind(next_name).bind(next_role).bind(next_active).bind(next_password).bind(next_provider)
        .bind(next_session_version).bind(next_active).bind(next_active).bind(now).bind(&id)
        .bind(would_remove_admin).execute(&state.pool).await?;
    if updated.rows_affected() == 0 {
        return Err(ApiError::conflict(
            "last_admin",
            "Le dernier administrateur actif doit être conservé.",
        ));
    }
    Ok(Json(
        find_user_by_id(&state.pool, &id)
            .await?
            .ok_or_else(ApiError::not_found)?
            .into(),
    ))
}

pub async fn delete_user(
    State(state): State<AppState>,
    Path(id): Path<String>,
    auth_session: AuthSession<AuthBackend>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let actor = authenticate_mutation(&auth_session, &headers).await?;
    require_admin(&actor)?;
    if actor.id == id {
        return Err(ApiError::forbidden(
            "Vous ne pouvez pas supprimer votre propre compte.",
        ));
    }
    let target = find_user_by_id(&state.pool, &id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    if target.is_active {
        return Err(ApiError::conflict(
            "active_user",
            "Désactivez ce compte avant de le supprimer.",
        ));
    }
    sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn registration_setting(
    State(state): State<AppState>,
    auth_session: AuthSession<AuthBackend>,
) -> Result<Json<RegistrationResponse>, ApiError> {
    let actor = authenticated_user(&auth_session)?;
    require_admin(&actor)?;
    let enabled = sqlx::query_scalar::<_, String>(
        "SELECT value FROM settings WHERE key = 'registration_enabled'",
    )
    .fetch_one(&state.pool)
    .await?
        == "true";
    Ok(Json(RegistrationResponse { enabled }))
}

pub async fn update_registration_setting(
    State(state): State<AppState>,
    auth_session: AuthSession<AuthBackend>,
    headers: HeaderMap,
    Json(body): Json<RegistrationSettingInput>,
) -> Result<Json<RegistrationResponse>, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let actor = authenticate_mutation(&auth_session, &headers).await?;
    require_admin(&actor)?;
    sqlx::query("UPDATE settings SET value = ? WHERE key = 'registration_enabled'")
        .bind(if body.enabled { "true" } else { "false" })
        .execute(&state.pool)
        .await?;
    Ok(Json(RegistrationResponse {
        enabled: body.enabled,
    }))
}

async fn password_for_provider(
    password: Option<String>,
    email: &str,
    provider: &str,
) -> Result<String, ApiError> {
    let password = password.filter(|value| !value.is_empty());
    match (provider, password) {
        ("oidc", _) => Ok(String::new()),
        (_, Some(password)) => {
            validate_password(&password, email)?;
            hash_password(password).await
        }
        _ => Err(ApiError::bad_request(
            "password_required",
            "Un mot de passe est requis pour la connexion locale.",
            Some("password"),
        )),
    }
}
