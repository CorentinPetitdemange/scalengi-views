use std::path::Path;

use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    Row, SqlitePool,
};

use crate::error::ApiError;

pub async fn connect(path: &Path) -> Result<SqlitePool, ApiError> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|error| ApiError::Internal(format!("database directory: {error}")))?;
    }
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .busy_timeout(std::time::Duration::from_secs(5));
    let pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect_with(options)
        .await?;
    migrate(&pool).await?;
    Ok(pool)
}

async fn migrate(pool: &SqlitePool) -> Result<(), ApiError> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY NOT NULL,
            email TEXT NOT NULL COLLATE NOCASE UNIQUE,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            auth_provider TEXT NOT NULL DEFAULT 'local',
            session_version TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
            is_active INTEGER NOT NULL DEFAULT 1,
            failed_login_attempts INTEGER NOT NULL DEFAULT 0,
            locked_until INTEGER,
            last_login_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        -- Versions before OIDC used a custom sessions table. The maintained tower-sessions
        -- store uses `tower_sessions`; legacy sessions cannot be migrated safely.
        DROP TABLE IF EXISTS sessions;

        CREATE TABLE IF NOT EXISTS oidc_identities (
            issuer TEXT NOT NULL,
            subject TEXT NOT NULL,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at INTEGER NOT NULL,
            last_login_at INTEGER NOT NULL,
            PRIMARY KEY (issuer, subject),
            UNIQUE (user_id, issuer)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
        );

        INSERT OR IGNORE INTO settings(key, value) VALUES ('bootstrap_claimed', 'false');
        INSERT OR IGNORE INTO settings(key, value) VALUES ('registration_enabled', 'false');
        "#,
    )
    .execute(pool)
    .await?;
    ensure_user_column(pool, "auth_provider", "TEXT NOT NULL DEFAULT 'local'").await?;
    ensure_user_column(pool, "session_version", "TEXT NOT NULL DEFAULT ''").await?;
    sqlx::query(
        "UPDATE users SET session_version = lower(hex(randomblob(32))) WHERE session_version = ''",
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn ensure_user_column(
    pool: &SqlitePool,
    name: &str,
    definition: &str,
) -> Result<(), ApiError> {
    let exists = sqlx::query("PRAGMA table_info(users)")
        .fetch_all(pool)
        .await?
        .iter()
        .any(|row| row.get::<String, _>("name") == name);
    if !exists {
        sqlx::query(&format!("ALTER TABLE users ADD COLUMN {name} {definition}"))
            .execute(pool)
            .await?;
    }
    Ok(())
}
