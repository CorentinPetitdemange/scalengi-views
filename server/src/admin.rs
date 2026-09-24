use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::Serialize;
use uuid::Uuid;

use crate::{
    auth::{authenticate_mutation, require_admin, require_allowed_origin},
    error::ApiError,
    models::{
        AdminCreateUserInput, AdminUpdateUserInput, PublicUser, RegistrationSettingInput,
        UserRecord,
    },
    security::{
        hash_password, normalize_email, validate_display_name, validate_password, validate_role,
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
    headers: HeaderMap,
) -> Result<Json<UsersResponse>, ApiError> {
    let authenticated = crate::auth::authenticate(&state, &headers).await?;
    require_admin(&authenticated)?;
    let users = sqlx::query_as::<_, UserRecord>(
        "SELECT id, email, display_name, password_hash, role, is_active, failed_login_attempts, locked_until, last_login_at, created_at FROM users ORDER BY display_name COLLATE NOCASE, email",
    )
    .fetch_all(&state.pool).await?.into_iter().map(PublicUser::from).collect();
    Ok(Json(UsersResponse { users }))
}

pub async fn create_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<AdminCreateUserInput>,
) -> Result<(StatusCode, Json<PublicUser>), ApiError> {
    require_allowed_origin(&state, &headers)?;
    let authenticated = authenticate_mutation(&state, &headers).await?;
    require_admin(&authenticated)?;
    let email = normalize_email(&body.email)?;
    let display_name = validate_display_name(&body.display_name)?;
    validate_password(&body.password, &email)?;
    let role = validate_role(&body.role)?.to_owned();
    let password_hash = hash_password(body.password).await?;
    let now = Utc::now().timestamp();
    let user = UserRecord {
        id: Uuid::new_v4().to_string(),
        email,
        display_name,
        password_hash,
        role,
        is_active: true,
        failed_login_attempts: 0,
        locked_until: None,
        last_login_at: None,
        created_at: now,
    };
    let result = sqlx::query("INSERT INTO users(id, email, display_name, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)")
        .bind(&user.id).bind(&user.email).bind(&user.display_name).bind(&user.password_hash).bind(&user.role).bind(now).bind(now)
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
    headers: HeaderMap,
    Json(body): Json<AdminUpdateUserInput>,
) -> Result<Json<PublicUser>, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let authenticated = authenticate_mutation(&state, &headers).await?;
    require_admin(&authenticated)?;
    let current = get_user(&state, &id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    if authenticated.user.id == id
        && body
            .password
            .as_ref()
            .is_some_and(|password| !password.is_empty())
    {
        return Err(ApiError::forbidden(
            "Utilisez Mon compte et confirmez votre mot de passe actuel.",
        ));
    }
    if authenticated.user.id == id
        && (body.role.as_deref().is_some_and(|role| role != "admin")
            || body.is_active == Some(false))
    {
        return Err(ApiError::forbidden("Vous ne pouvez pas retirer vos propres droits administrateur ni désactiver votre compte."));
    }
    let display_name = match body.display_name {
        Some(value) => Some(validate_display_name(&value)?),
        None => None,
    };
    let role = match body.role {
        Some(value) => Some(validate_role(&value)?.to_owned()),
        None => None,
    };
    let would_remove_admin = current.role == "admin"
        && current.is_active
        && (role.as_deref().is_some_and(|value| value != "admin") || body.is_active == Some(false));
    let password_hash = if let Some(password) = body.password.filter(|value| !value.is_empty()) {
        validate_password(&password, &current.email)?;
        Some(hash_password(password).await?)
    } else {
        None
    };
    let now = Utc::now().timestamp();
    let next_name = display_name.unwrap_or(current.display_name);
    let next_role = role.unwrap_or(current.role);
    let next_active = body.is_active.unwrap_or(current.is_active);
    let next_password = password_hash.clone().unwrap_or(current.password_hash);
    let mut transaction = state.pool.begin().await?;
    let updated = sqlx::query("UPDATE users SET display_name = ?, role = ?, is_active = ?, password_hash = ?, failed_login_attempts = CASE WHEN ? THEN 0 ELSE failed_login_attempts END, locked_until = CASE WHEN ? THEN NULL ELSE locked_until END, updated_at = ? WHERE id = ? AND (? = 0 OR (SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1) > 1)")
        .bind(next_name).bind(next_role).bind(next_active).bind(next_password)
        .bind(next_active).bind(next_active).bind(now).bind(&id).bind(would_remove_admin)
        .execute(&mut *transaction).await?;
    if updated.rows_affected() == 0 {
        transaction.rollback().await?;
        return Err(ApiError::conflict(
            "last_admin",
            "Le dernier administrateur actif doit être conservé.",
        ));
    }
    if !next_active || password_hash.is_some() {
        sqlx::query("DELETE FROM sessions WHERE user_id = ?")
            .bind(&id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
    Ok(Json(
        get_user(&state, &id)
            .await?
            .ok_or_else(ApiError::not_found)?
            .into(),
    ))
}

pub async fn delete_user(
    State(state): State<AppState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let authenticated = authenticate_mutation(&state, &headers).await?;
    require_admin(&authenticated)?;
    if authenticated.user.id == id {
        return Err(ApiError::forbidden(
            "Vous ne pouvez pas supprimer votre propre compte.",
        ));
    }
    let target = get_user(&state, &id)
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
    headers: HeaderMap,
) -> Result<Json<RegistrationResponse>, ApiError> {
    let authenticated = crate::auth::authenticate(&state, &headers).await?;
    require_admin(&authenticated)?;
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
    headers: HeaderMap,
    Json(body): Json<RegistrationSettingInput>,
) -> Result<Json<RegistrationResponse>, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let authenticated = authenticate_mutation(&state, &headers).await?;
    require_admin(&authenticated)?;
    sqlx::query("UPDATE settings SET value = ? WHERE key = 'registration_enabled'")
        .bind(if body.enabled { "true" } else { "false" })
        .execute(&state.pool)
        .await?;
    Ok(Json(RegistrationResponse {
        enabled: body.enabled,
    }))
}

async fn get_user(state: &AppState, id: &str) -> Result<Option<UserRecord>, ApiError> {
    Ok(sqlx::query_as::<_, UserRecord>("SELECT id, email, display_name, password_hash, role, is_active, failed_login_attempts, locked_until, last_login_at, created_at FROM users WHERE id = ?")
        .bind(id).fetch_optional(&state.pool).await?)
}
