use std::{collections::HashSet, sync::Arc};

use axum_login::{AuthUser, AuthnBackend, AuthzBackend, UserId};
use chrono::Utc;
use sqlx::SqlitePool;

use crate::{
    error::ApiError,
    models::{Credentials, UserRecord},
    security::{normalize_email, verify_password},
};

const MAX_FAILED_LOGINS: i64 = 5;
const LOCK_SECONDS: i64 = 15 * 60;

#[derive(Clone)]
pub struct AuthBackend {
    pool: SqlitePool,
    dummy_password_hash: Arc<String>,
}

impl AuthBackend {
    pub fn new(pool: SqlitePool, dummy_password_hash: String) -> Self {
        Self {
            pool,
            dummy_password_hash: Arc::new(dummy_password_hash),
        }
    }
}

impl AuthUser for UserRecord {
    type Id = String;

    fn id(&self) -> Self::Id {
        self.id.clone()
    }

    fn session_auth_hash(&self) -> &[u8] {
        self.session_version.as_bytes()
    }
}

impl AuthnBackend for AuthBackend {
    type User = UserRecord;
    type Credentials = Credentials;
    type Error = ApiError;

    async fn authenticate(
        &self,
        credentials: Self::Credentials,
    ) -> Result<Option<Self::User>, Self::Error> {
        let email = normalize_email(&credentials.email)?;
        let user = find_user_by_email(&self.pool, &email).await?;
        let encoded = user
            .as_ref()
            .filter(|candidate| matches!(candidate.auth_provider.as_str(), "local" | "both"))
            .map(|candidate| candidate.password_hash.clone())
            .filter(|hash| !hash.is_empty())
            .unwrap_or_else(|| (*self.dummy_password_hash).clone());
        let password_valid = verify_password(credentials.password, encoded).await;
        let now = Utc::now().timestamp();

        let Some(mut user) = user else {
            return Ok(None);
        };
        let supports_local = matches!(user.auth_provider.as_str(), "local" | "both")
            && !user.password_hash.is_empty();
        if !password_valid
            || !supports_local
            || !user.is_active
            || user.locked_until.is_some_and(|until| until > now)
        {
            if user.is_active
                && supports_local
                && user.locked_until.is_none_or(|until| until <= now)
            {
                let attempts = user.failed_login_attempts + 1;
                if attempts >= MAX_FAILED_LOGINS {
                    sqlx::query("UPDATE users SET failed_login_attempts = 0, locked_until = ?, updated_at = ? WHERE id = ?")
                        .bind(now + LOCK_SECONDS).bind(now).bind(&user.id).execute(&self.pool).await?;
                } else {
                    sqlx::query("UPDATE users SET failed_login_attempts = ?, locked_until = NULL, updated_at = ? WHERE id = ?")
                        .bind(attempts).bind(now).bind(&user.id).execute(&self.pool).await?;
                }
            }
            return Ok(None);
        }

        sqlx::query("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?")
            .bind(now).bind(now).bind(&user.id).execute(&self.pool).await?;
        user.failed_login_attempts = 0;
        user.locked_until = None;
        user.last_login_at = Some(now);
        Ok(Some(user))
    }

    async fn get_user(&self, user_id: &UserId<Self>) -> Result<Option<Self::User>, Self::Error> {
        Ok(find_user_by_id(&self.pool, user_id)
            .await?
            .filter(|user| user.is_active))
    }
}

impl AuthzBackend for AuthBackend {
    type Permission = String;

    async fn get_user_permissions(
        &self,
        user: &Self::User,
    ) -> Result<HashSet<Self::Permission>, Self::Error> {
        let mut permissions = HashSet::new();
        if user.role == "admin" {
            permissions.insert("admin:users".into());
            permissions.insert("admin:settings".into());
        }
        Ok(permissions)
    }
}

pub async fn find_user_by_id(pool: &SqlitePool, id: &str) -> Result<Option<UserRecord>, ApiError> {
    Ok(
        sqlx::query_as::<_, UserRecord>(crate::models::USER_SELECT_BY_ID)
            .bind(id)
            .fetch_optional(pool)
            .await?,
    )
}

pub async fn find_user_by_email(
    pool: &SqlitePool,
    email: &str,
) -> Result<Option<UserRecord>, ApiError> {
    Ok(
        sqlx::query_as::<_, UserRecord>(crate::models::USER_SELECT_BY_EMAIL)
            .bind(email)
            .fetch_optional(pool)
            .await?,
    )
}
