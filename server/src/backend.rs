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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::security::{hash_password, random_token};
    use uuid::Uuid;

    async fn backend_with_local_user() -> (AuthBackend, SqlitePool, String) {
        let database_path =
            std::env::temp_dir().join(format!("scalengi-auth-backend-{}.sqlite3", Uuid::new_v4()));
        let pool = crate::db::connect(&database_path).await.expect("database");
        let password_hash = hash_password("Correct-Horse-42!".into())
            .await
            .expect("password hash");
        let dummy_hash = hash_password(random_token()).await.expect("dummy hash");
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().timestamp();
        sqlx::query("INSERT INTO users(id, email, display_name, password_hash, auth_provider, session_version, role, is_active, created_at, updated_at) VALUES (?, 'alice@example.com', 'Alice', ?, 'local', ?, 'member', 1, ?, ?)")
            .bind(&id)
            .bind(password_hash)
            .bind(random_token())
            .bind(now)
            .bind(now)
            .execute(&pool)
            .await
            .expect("user");
        (AuthBackend::new(pool.clone(), dummy_hash), pool, id)
    }

    fn credentials(password: &str) -> Credentials {
        Credentials {
            email: "alice@example.com".into(),
            password: password.into(),
        }
    }

    #[tokio::test]
    async fn successful_login_resets_failures_and_five_failures_lock_the_account() {
        let (backend, pool, id) = backend_with_local_user().await;

        for _ in 0..4 {
            assert!(backend
                .authenticate(credentials("Wrong-Password-42!"))
                .await
                .expect("failed authentication")
                .is_none());
        }
        assert!(backend
            .authenticate(credentials("Correct-Horse-42!"))
            .await
            .expect("successful authentication")
            .is_some());
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT failed_login_attempts FROM users WHERE id = ?")
                .bind(&id)
                .fetch_one(&pool)
                .await
                .expect("attempt count"),
            0
        );

        for _ in 0..5 {
            assert!(backend
                .authenticate(credentials("Wrong-Password-42!"))
                .await
                .expect("failed authentication")
                .is_none());
        }
        assert!(backend
            .authenticate(credentials("Correct-Horse-42!"))
            .await
            .expect("locked authentication")
            .is_none());
        let locked_until =
            sqlx::query_scalar::<_, i64>("SELECT locked_until FROM users WHERE id = ?")
                .bind(&id)
                .fetch_one(&pool)
                .await
                .expect("lock deadline");
        assert!(locked_until > Utc::now().timestamp());
    }

    #[tokio::test]
    async fn unknown_inactive_and_sso_only_accounts_never_authenticate_locally() {
        let (backend, pool, id) = backend_with_local_user().await;
        assert!(backend
            .authenticate(Credentials {
                email: "missing@example.com".into(),
                password: "Correct-Horse-42!".into(),
            })
            .await
            .expect("unknown authentication")
            .is_none());

        sqlx::query("UPDATE users SET is_active = 0 WHERE id = ?")
            .bind(&id)
            .execute(&pool)
            .await
            .expect("deactivate user");
        assert!(backend
            .authenticate(credentials("Correct-Horse-42!"))
            .await
            .expect("inactive authentication")
            .is_none());

        sqlx::query("UPDATE users SET is_active = 1, auth_provider = 'oidc' WHERE id = ?")
            .bind(&id)
            .execute(&pool)
            .await
            .expect("switch provider");
        assert!(backend
            .authenticate(credentials("Correct-Horse-42!"))
            .await
            .expect("SSO-only authentication")
            .is_none());
    }
}
