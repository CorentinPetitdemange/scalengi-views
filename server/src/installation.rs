use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    config::{Config, InstallationProfile},
    security::{
        hash_password, normalize_email, random_token, validate_display_name, validate_password,
    },
};

const PROFILE_SETTING: &str = "installation_profile";

pub async fn initialize(
    pool: &SqlitePool,
    config: &Config,
    demo_admin: Option<&crate::config::DemoAdminConfig>,
    demo_admin_password: Option<&str>,
) -> Result<InstallationProfile, String> {
    let stored_profile =
        sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
            .bind(PROFILE_SETTING)
            .fetch_optional(pool)
            .await
            .map_err(database_error)?;

    if let Some(stored) = stored_profile {
        let effective = InstallationProfile::parse(&stored)
            .map_err(|_| "profil d’installation persistant invalide".to_owned())?;
        if config.installation_profile_explicit && config.installation_profile != effective {
            return Err(format!(
                "le profil d’installation est immuable après l’initialisation (profil actuel: {})",
                effective.as_str()
            ));
        }
        return Ok(effective);
    }

    let account_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await
        .map_err(database_error)?;
    if account_count > 0 {
        if config.installation_profile_explicit
            && config.installation_profile == InstallationProfile::Demo
        {
            return Err("le profil demo ne peut être activé sur une installation contenant déjà des comptes".into());
        }
        persist_standard_profile(pool).await?;
        return Ok(InstallationProfile::Standard);
    }

    match config.installation_profile {
        InstallationProfile::Standard => {
            persist_standard_profile(pool).await?;
            Ok(InstallationProfile::Standard)
        }
        InstallationProfile::Demo => {
            seed_demo_admin(pool, demo_admin, demo_admin_password).await?;
            Ok(InstallationProfile::Demo)
        }
    }
}

async fn persist_standard_profile(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query("INSERT INTO settings(key, value) VALUES (?, ?)")
        .bind(PROFILE_SETTING)
        .bind(InstallationProfile::Standard.as_str())
        .execute(pool)
        .await
        .map_err(database_error)?;
    Ok(())
}

async fn seed_demo_admin(
    pool: &SqlitePool,
    demo_admin: Option<&crate::config::DemoAdminConfig>,
    demo_admin_password: Option<&str>,
) -> Result<(), String> {
    let demo = demo_admin.ok_or_else(|| {
        "le profil demo exige SCALENGI_DEMO_ADMIN_EMAIL et SCALENGI_DEMO_ADMIN_PASSWORD(_FILE) lors du premier démarrage".to_owned()
    })?;
    let password = demo_admin_password.ok_or_else(|| {
        "le profil demo exige SCALENGI_DEMO_ADMIN_EMAIL et SCALENGI_DEMO_ADMIN_PASSWORD(_FILE) lors du premier démarrage".to_owned()
    })?;
    let email = normalize_email(&demo.email).map_err(validation_error)?;
    let display_name = validate_display_name(&demo.display_name).map_err(validation_error)?;
    validate_password(password, &email).map_err(validation_error)?;
    let password_hash = hash_password(password.to_owned())
        .await
        .map_err(validation_error)?;
    let now = Utc::now().timestamp();

    let mut transaction = pool.begin().await.map_err(database_error)?;
    let account_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(&mut *transaction)
        .await
        .map_err(database_error)?;
    if account_count != 0 {
        transaction.rollback().await.map_err(database_error)?;
        return Err("un compte a été créé pendant l’initialisation de la démo; aucun identifiant n’a été modifié".into());
    }

    sqlx::query("INSERT INTO users(id, email, display_name, password_hash, auth_provider, session_version, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 'local', ?, 'admin', 1, ?, ?)")
        .bind(Uuid::new_v4().to_string())
        .bind(email)
        .bind(display_name)
        .bind(password_hash)
        .bind(random_token())
        .bind(now)
        .bind(now)
        .execute(&mut *transaction)
        .await
        .map_err(database_error)?;
    sqlx::query("UPDATE settings SET value = 'true' WHERE key = 'bootstrap_claimed'")
        .execute(&mut *transaction)
        .await
        .map_err(database_error)?;
    sqlx::query("INSERT INTO settings(key, value) VALUES (?, ?)")
        .bind(PROFILE_SETTING)
        .bind(InstallationProfile::Demo.as_str())
        .execute(&mut *transaction)
        .await
        .map_err(database_error)?;
    transaction.commit().await.map_err(database_error)?;
    Ok(())
}

fn validation_error(error: crate::error::ApiError) -> String {
    format!("configuration du compte administrateur de démonstration: {error}")
}

fn database_error(error: sqlx::Error) -> String {
    format!("initialisation de l’installation: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{config::DemoAdminConfig, db, security::verify_password};

    fn config(profile: InstallationProfile) -> Config {
        Config {
            bind: "127.0.0.1:0".parse().expect("test bind"),
            database_path: std::env::temp_dir().join("unused.sqlite3"),
            allowed_origins: vec!["http://localhost:3000".into()],
            cookie_secure: false,
            session_lifetime_seconds: 3600,
            oidc: None,
            oidc_client_secret: None,
            installation_profile: profile,
            installation_profile_explicit: true,
        }
    }

    async fn database() -> SqlitePool {
        let path =
            std::env::temp_dir().join(format!("scalengi-installation-{}.sqlite3", Uuid::new_v4()));
        db::connect(&path).await.expect("test database")
    }

    fn demo() -> DemoAdminConfig {
        DemoAdminConfig {
            email: "admin@demo.example".into(),
            display_name: "Administration Démo".into(),
        }
    }

    fn strong_test_password() -> String {
        format!("Aa1!{}", random_token())
    }

    #[tokio::test]
    async fn standard_installation_starts_without_accounts() {
        let pool = database().await;
        let profile = initialize(&pool, &config(InstallationProfile::Standard), None, None)
            .await
            .expect("standard installation");
        assert_eq!(profile, InstallationProfile::Standard);
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
                .fetch_one(&pool)
                .await
                .expect("count users"),
            0
        );
    }

    #[tokio::test]
    async fn demo_installation_creates_one_hashed_admin_and_is_idempotent() {
        let pool = database().await;
        let password = strong_test_password();
        let initial = config(InstallationProfile::Demo);
        let initial_admin = demo();
        assert_eq!(
            initialize(&pool, &initial, Some(&initial_admin), Some(&password))
                .await
                .expect("demo installation"),
            InstallationProfile::Demo
        );
        let (stored_hash, role, bootstrap_claimed): (String, String, String) = sqlx::query_as(
            "SELECT u.password_hash, u.role, s.value FROM users u CROSS JOIN settings s WHERE s.key = 'bootstrap_claimed'",
        )
        .fetch_one(&pool)
        .await
        .expect("seeded admin");
        assert_ne!(stored_hash, password);
        assert!(verify_password(password, stored_hash.clone()).await);
        assert_eq!(role, "admin");
        assert_eq!(bootstrap_claimed, "true");

        let changed = config(InstallationProfile::Demo);
        let changed_admin = demo();
        let changed_password = strong_test_password();
        assert_eq!(
            initialize(
                &pool,
                &changed,
                Some(&changed_admin),
                Some(&changed_password),
            )
            .await
            .expect("idempotent restart"),
            InstallationProfile::Demo
        );
        let hashes = sqlx::query_scalar::<_, String>("SELECT password_hash FROM users")
            .fetch_all(&pool)
            .await
            .expect("stored hashes");
        assert_eq!(hashes, vec![stored_hash]);
    }

    #[tokio::test]
    async fn demo_requires_explicit_credentials_and_cannot_replace_a_real_installation() {
        let pool = database().await;
        let missing = initialize(&pool, &config(InstallationProfile::Demo), None, None)
            .await
            .expect_err("missing demo credentials");
        assert!(missing.contains("exige"));

        initialize(&pool, &config(InstallationProfile::Standard), None, None)
            .await
            .expect("standard installation");
        let demo_admin = demo();
        let demo_password = strong_test_password();
        let switch = initialize(
            &pool,
            &config(InstallationProfile::Demo),
            Some(&demo_admin),
            Some(&demo_password),
        )
        .await
        .expect_err("immutable installation profile");
        assert!(switch.contains("immuable"));
    }
}
