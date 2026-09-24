use serde::{Deserialize, Serialize};
use sqlx::FromRow;

pub const USER_COLUMNS: &str = "id, email, display_name, password_hash, auth_provider, session_version, role, is_active, failed_login_attempts, locked_until, last_login_at, created_at";
pub const USER_SELECT_BY_ID: &str = "SELECT id, email, display_name, password_hash, auth_provider, session_version, role, is_active, failed_login_attempts, locked_until, last_login_at, created_at FROM users WHERE id = ?";
pub const USER_SELECT_BY_EMAIL: &str = "SELECT id, email, display_name, password_hash, auth_provider, session_version, role, is_active, failed_login_attempts, locked_until, last_login_at, created_at FROM users WHERE email = ?";

#[derive(Clone, Debug, FromRow)]
pub struct UserRecord {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub password_hash: String,
    pub auth_provider: String,
    pub session_version: String,
    pub role: String,
    pub is_active: bool,
    pub failed_login_attempts: i64,
    pub locked_until: Option<i64>,
    pub last_login_at: Option<i64>,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicUser {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub role: String,
    pub auth_provider: String,
    pub is_active: bool,
    pub last_login_at: Option<i64>,
    pub created_at: i64,
}

impl From<UserRecord> for PublicUser {
    fn from(user: UserRecord) -> Self {
        Self {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            role: user.role,
            auth_provider: user.auth_provider,
            is_active: user.is_active,
            last_login_at: user.last_login_at,
            created_at: user.created_at,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Credentials {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RegisterInput {
    pub email: String,
    pub display_name: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProfileInput {
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PasswordInput {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AdminCreateUserInput {
    pub email: String,
    pub display_name: String,
    pub password: Option<String>,
    pub role: String,
    pub auth_provider: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AdminUpdateUserInput {
    pub display_name: Option<String>,
    pub role: Option<String>,
    pub is_active: Option<bool>,
    pub password: Option<String>,
    pub auth_provider: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RegistrationSettingInput {
    pub enabled: bool,
}
