mod admin;
mod auth;
mod backend;
mod config;
mod db;
mod error;
mod models;
mod oidc;
mod security;
mod state;

use std::sync::Arc;

use axum::{
    http::{header, HeaderValue, Method},
    routing::{get, patch, post},
    Router,
};
use axum_login::AuthManagerLayerBuilder;
use backend::AuthBackend;
use config::Config;
use state::AppState;
use time::Duration;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};
use tower_sessions::{
    cookie::SameSite, session_store::ExpiredDeletion, Expiry, SessionManagerLayer,
};
use tower_sessions_sqlx_store::SqliteStore;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "scalengi_views_auth=info,tower_http=info".into()),
        )
        .init();
    let config = Config::from_env().unwrap_or_else(|error| panic!("configuration error: {error}"));
    let pool = db::connect(&config.database_path)
        .await
        .unwrap_or_else(|error| panic!("database error: {error}"));
    let oidc = match config.oidc.clone() {
        Some(oidc_config) => Some(Arc::new(
            oidc::OidcService::discover(oidc_config)
                .await
                .unwrap_or_else(|error| panic!("configuration OIDC: {error}")),
        )),
        None => None,
    };
    let state = AppState {
        pool,
        config: Arc::new(config.clone()),
        oidc,
    };
    let app = app(state).await.expect("initialize authentication layers");
    let listener = tokio::net::TcpListener::bind(config.bind)
        .await
        .expect("bind auth server");
    tracing::info!(address = %config.bind, "Scalengi Views authentication server ready");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("serve auth server");
}

async fn app(state: AppState) -> Result<Router, String> {
    let origins = state
        .config
        .allowed_origins
        .iter()
        .filter_map(|origin| origin.parse::<HeaderValue>().ok())
        .collect::<Vec<_>>();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_credentials(true)
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
        .allow_headers([
            header::CONTENT_TYPE,
            header::HeaderName::from_static("x-csrf-token"),
        ]);
    let store = SqliteStore::new(state.pool.clone());
    store
        .migrate()
        .await
        .map_err(|error| format!("session database migration: {error}"))?;
    tokio::spawn(
        store
            .clone()
            .continuously_delete_expired(std::time::Duration::from_secs(10 * 60)),
    );
    let cookie_name = if state.config.cookie_secure {
        "__Host-scalengi_session"
    } else {
        "scalengi_session"
    };
    let session_layer = SessionManagerLayer::new(store)
        .with_name(cookie_name)
        .with_http_only(true)
        .with_same_site(SameSite::Lax)
        .with_secure(state.config.cookie_secure)
        .with_path("/")
        .with_expiry(Expiry::OnInactivity(Duration::seconds(
            state.config.session_lifetime_seconds,
        )));
    let dummy_password_hash = security::hash_password(security::random_token())
        .await
        .map_err(|error| format!("dummy password hash: {error}"))?;
    let backend = AuthBackend::new(state.pool.clone(), dummy_password_hash);
    let auth_layer = AuthManagerLayerBuilder::new(backend, session_layer).build();
    Ok(Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/auth/bootstrap", get(auth::bootstrap))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/me", get(auth::me).patch(auth::update_profile))
        .route("/api/auth/password", post(auth::change_password))
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/oidc/config", get(oidc::configuration))
        .route("/api/auth/oidc/start", get(oidc::start))
        .route("/api/auth/oidc/callback", get(oidc::callback))
        .route("/api/admin/users", get(admin::list_users).post(admin::create_user))
        .route("/api/admin/users/{id}", patch(admin::update_user).delete(admin::delete_user))
        .route("/api/admin/settings/registration", get(admin::registration_setting).patch(admin::update_registration_setting))
        .fallback(|| async { (axum::http::StatusCode::NOT_FOUND, axum::Json(serde_json::json!({"error":{"code":"not_found","message":"Ressource introuvable."}}))) })
        .layer(SetResponseHeaderLayer::if_not_present(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff")))
        .layer(SetResponseHeaderLayer::if_not_present(header::REFERRER_POLICY, HeaderValue::from_static("no-referrer")))
        .layer(SetResponseHeaderLayer::if_not_present(header::CACHE_CONTROL, HeaderValue::from_static("no-store")))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(auth_layer)
        .with_state(state))
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    async fn test_app() -> Router {
        let database_path =
            std::env::temp_dir().join(format!("scalengi-auth-{}.sqlite3", uuid::Uuid::new_v4()));
        let config = Config {
            bind: "127.0.0.1:0".parse().expect("test bind"),
            database_path: database_path.clone(),
            allowed_origins: vec!["http://localhost:3000".into()],
            cookie_secure: false,
            session_lifetime_seconds: 3600,
            oidc: None,
        };
        let pool = db::connect(&database_path).await.expect("test database");
        app(AppState {
            pool,
            config: Arc::new(config),
            oidc: None,
        })
        .await
        .expect("test app")
    }

    async fn test_app_with_oidc() -> Router {
        let database_path =
            std::env::temp_dir().join(format!("scalengi-oidc-{}.sqlite3", uuid::Uuid::new_v4()));
        let oidc_config = config::OidcConfig {
            issuer_url: "https://id.example.com".into(),
            client_id: "scalengi-test".into(),
            client_secret: "test-secret".into(),
            redirect_url: "http://localhost/api/auth/oidc/callback".into(),
            provider_name: "Test IdP".into(),
            allowed_domains: vec!["example.com".into()],
            allow_any_domain: false,
            jit_provisioning: false,
            local_login_enabled: true,
            require_verified_email: true,
            bootstrap_admin_email: None,
            end_session_url: None,
        };
        let service = oidc::OidcService::for_test(oidc_config.clone());
        let config = Config {
            bind: "127.0.0.1:0".parse().expect("test bind"),
            database_path: database_path.clone(),
            allowed_origins: vec!["http://localhost:3000".into()],
            cookie_secure: false,
            session_lifetime_seconds: 3600,
            oidc: Some(oidc_config),
        };
        let pool = db::connect(&database_path).await.expect("test database");
        app(AppState {
            pool,
            config: Arc::new(config),
            oidc: Some(Arc::new(service)),
        })
        .await
        .expect("test OIDC app")
    }

    fn json_request(method: &str, uri: &str, body: serde_json::Value) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(uri)
            .header("content-type", "application/json")
            .header("origin", "http://localhost:3000")
            .body(Body::from(body.to_string()))
            .expect("request")
    }

    struct TestSession {
        cookie: String,
        csrf: String,
        user_id: String,
    }

    async fn response_json(response: axum::response::Response) -> serde_json::Value {
        serde_json::from_slice(
            &response
                .into_body()
                .collect()
                .await
                .expect("body")
                .to_bytes(),
        )
        .expect("json")
    }

    async fn authenticated_session(response: axum::response::Response) -> TestSession {
        assert_eq!(response.status(), StatusCode::OK);
        let cookie = response
            .headers()
            .get("set-cookie")
            .expect("session cookie")
            .to_str()
            .expect("cookie text")
            .split(';')
            .next()
            .expect("cookie value")
            .to_owned();
        let body = response_json(response).await;
        TestSession {
            cookie,
            csrf: body["csrfToken"].as_str().expect("csrf").to_owned(),
            user_id: body["user"]["id"].as_str().expect("user id").to_owned(),
        }
    }

    async fn register_user(
        router: &Router,
        display_name: &str,
        email: &str,
        password: &str,
    ) -> TestSession {
        let response = router
            .clone()
            .oneshot(json_request(
                "POST",
                "/api/auth/register",
                serde_json::json!({
                    "displayName": display_name,
                    "email": email,
                    "password": password
                }),
            ))
            .await
            .expect("registration response");
        authenticated_session(response).await
    }

    #[tokio::test]
    async fn first_account_is_admin_and_registration_closes() {
        let router = test_app().await;
        let response = router
            .clone()
            .oneshot(json_request(
                "POST",
                "/api/auth/register",
                serde_json::json!({
                    "displayName": "Admin Test",
                    "email": "admin@example.com",
                    "password": "Correct-Horse-42!"
                }),
            ))
            .await
            .expect("registration response");
        assert_eq!(response.status(), StatusCode::OK);
        let cookie = response
            .headers()
            .get("set-cookie")
            .expect("session cookie")
            .to_str()
            .expect("cookie text")
            .to_owned();
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("SameSite=Lax"));
        assert!(cookie.contains("Path=/"));
        let body: serde_json::Value = serde_json::from_slice(
            &response
                .into_body()
                .collect()
                .await
                .expect("body")
                .to_bytes(),
        )
        .expect("json");
        assert_eq!(body["user"]["role"], "admin");
        let csrf = body["csrfToken"].as_str().expect("csrf");
        let user_id = body["user"]["id"].as_str().expect("user id");

        let second = router
            .clone()
            .oneshot(json_request(
                "POST",
                "/api/auth/register",
                serde_json::json!({
                    "displayName": "Second User",
                    "email": "second@example.com",
                    "password": "Granite-Bridge-42!"
                }),
            ))
            .await
            .expect("second registration response");
        assert_eq!(second.status(), StatusCode::FORBIDDEN);

        let self_deactivation = router
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri(format!("/api/admin/users/{user_id}"))
                    .header("content-type", "application/json")
                    .header("origin", "http://localhost:3000")
                    .header("cookie", cookie.split(';').next().expect("cookie value"))
                    .header("x-csrf-token", csrf)
                    .body(Body::from(r#"{"isActive":false}"#))
                    .expect("request"),
            )
            .await
            .expect("self deactivation response");
        assert_eq!(self_deactivation.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn oidc_start_uses_pkce_and_callback_state_is_single_use() {
        let router = test_app_with_oidc().await;
        let start = router
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/auth/oidc/start?returnTo=%2Faccount")
                    .body(Body::empty())
                    .expect("start request"),
            )
            .await
            .expect("start response");
        assert_eq!(start.status(), StatusCode::SEE_OTHER);
        let location = start
            .headers()
            .get("location")
            .expect("authorization location")
            .to_str()
            .expect("location text")
            .to_owned();
        assert!(location.contains("code_challenge="));
        assert!(location.contains("code_challenge_method=S256"));
        assert!(location.contains("nonce="));
        let cookie = start
            .headers()
            .get("set-cookie")
            .expect("flow session cookie")
            .to_str()
            .expect("cookie text")
            .split(';')
            .next()
            .expect("cookie value")
            .to_owned();
        let state = location
            .split('&')
            .find_map(|part| part.strip_prefix("state="))
            .expect("state")
            .to_owned();

        let mismatched = router
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/auth/oidc/callback?code=fake&state=attacker")
                    .header("cookie", &cookie)
                    .body(Body::empty())
                    .expect("callback request"),
            )
            .await
            .expect("callback response");
        assert_eq!(mismatched.status(), StatusCode::SEE_OTHER);
        assert!(mismatched
            .headers()
            .get("location")
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.contains("ssoError=oidc_state_invalid")));

        let replay = router
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/api/auth/oidc/callback?code=fake&state={state}"))
                    .header("cookie", &cookie)
                    .body(Body::empty())
                    .expect("replay request"),
            )
            .await
            .expect("replay response");
        assert_eq!(replay.status(), StatusCode::SEE_OTHER);
        assert!(replay
            .headers()
            .get("location")
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.contains("ssoError=oidc_flow_missing")));

        let registration = router
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/auth/register")
                    .header("content-type", "application/json")
                    .header("origin", "http://localhost:3000")
                    .header("cookie", &cookie)
                    .body(Body::from(
                        serde_json::json!({
                            "displayName": "Session Rotation",
                            "email": "rotation@example.com",
                            "password": "Correct-Horse-42!"
                        })
                        .to_string(),
                    ))
                    .expect("registration request"),
            )
            .await
            .expect("registration response");
        assert_eq!(registration.status(), StatusCode::OK);
        let rotated_cookie = registration
            .headers()
            .get("set-cookie")
            .expect("rotated session cookie")
            .to_str()
            .expect("cookie text");
        assert_ne!(
            rotated_cookie.split(';').next(),
            Some(cookie.as_str()),
            "authentication must rotate the pre-authentication session id"
        );
    }

    #[tokio::test]
    async fn origin_and_csrf_checks_cannot_be_bypassed_with_forwarded_headers() {
        let router = test_app().await;
        let forged_registration = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/auth/register")
                    .header("content-type", "application/json")
                    .header("origin", "https://attacker.example")
                    .header("x-forwarded-host", "attacker.example")
                    .body(Body::from(
                        serde_json::json!({
                            "displayName": "Attacker",
                            "email": "attacker@example.com",
                            "password": "Correct-Horse-42!"
                        })
                        .to_string(),
                    ))
                    .expect("forged request"),
            )
            .await
            .expect("forged response");
        assert_eq!(forged_registration.status(), StatusCode::FORBIDDEN);

        let admin = register_user(
            &router,
            "Admin Test",
            "admin@example.com",
            "Correct-Horse-42!",
        )
        .await;
        let without_csrf = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/auth/me")
                    .header("content-type", "application/json")
                    .header("origin", "http://localhost:3000")
                    .header("cookie", &admin.cookie)
                    .body(Body::from(r#"{"displayName":"Updated Admin"}"#))
                    .expect("missing CSRF request"),
            )
            .await
            .expect("missing CSRF response");
        assert_eq!(without_csrf.status(), StatusCode::FORBIDDEN);

        let forged_origin = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/auth/me")
                    .header("content-type", "application/json")
                    .header("origin", "https://attacker.example")
                    .header("x-forwarded-host", "attacker.example")
                    .header("cookie", &admin.cookie)
                    .header("x-csrf-token", &admin.csrf)
                    .body(Body::from(r#"{"displayName":"Updated Admin"}"#))
                    .expect("forged origin request"),
            )
            .await
            .expect("forged origin response");
        assert_eq!(forged_origin.status(), StatusCode::FORBIDDEN);

        let accepted = router
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/auth/me")
                    .header("content-type", "application/json")
                    .header("origin", "http://localhost:3000")
                    .header("cookie", &admin.cookie)
                    .header("x-csrf-token", &admin.csrf)
                    .body(Body::from(r#"{"displayName":"Updated Admin"}"#))
                    .expect("valid request"),
            )
            .await
            .expect("valid response");
        assert_eq!(accepted.status(), StatusCode::OK);
        assert_eq!(accepted.headers()[header::CACHE_CONTROL], "no-store");
        assert_eq!(
            accepted.headers()[header::X_CONTENT_TYPE_OPTIONS],
            "nosniff"
        );
    }

    #[tokio::test]
    async fn admin_changes_are_role_protected_and_invalidate_existing_sessions() {
        let router = test_app().await;
        let admin = register_user(
            &router,
            "Admin Test",
            "admin@example.com",
            "Correct-Horse-42!",
        )
        .await;
        let created = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/admin/users")
                    .header("content-type", "application/json")
                    .header("origin", "http://localhost:3000")
                    .header("cookie", &admin.cookie)
                    .header("x-csrf-token", &admin.csrf)
                    .body(Body::from(
                        serde_json::json!({
                            "displayName": "Member Test",
                            "email": "member@example.com",
                            "password": "Granite-Bridge-42!",
                            "role": "member",
                            "authProvider": "local"
                        })
                        .to_string(),
                    ))
                    .expect("create member request"),
            )
            .await
            .expect("create member response");
        assert_eq!(created.status(), StatusCode::CREATED);
        let member_id = response_json(created).await["id"]
            .as_str()
            .expect("member id")
            .to_owned();

        let member = authenticated_session(
            router
                .clone()
                .oneshot(json_request(
                    "POST",
                    "/api/auth/login",
                    serde_json::json!({
                        "email": "member@example.com",
                        "password": "Granite-Bridge-42!"
                    }),
                ))
                .await
                .expect("member login response"),
        )
        .await;
        assert_eq!(member.user_id, member_id);

        let forbidden = router
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/admin/users")
                    .header("cookie", &member.cookie)
                    .body(Body::empty())
                    .expect("member admin request"),
            )
            .await
            .expect("member admin response");
        assert_eq!(forbidden.status(), StatusCode::FORBIDDEN);

        let deactivated = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri(format!("/api/admin/users/{member_id}"))
                    .header("content-type", "application/json")
                    .header("origin", "http://localhost:3000")
                    .header("cookie", &admin.cookie)
                    .header("x-csrf-token", &admin.csrf)
                    .body(Body::from(r#"{"isActive":false}"#))
                    .expect("deactivate member request"),
            )
            .await
            .expect("deactivate member response");
        assert_eq!(deactivated.status(), StatusCode::OK);

        let stale_session = router
            .oneshot(
                Request::builder()
                    .uri("/api/auth/me")
                    .header("cookie", &member.cookie)
                    .body(Body::empty())
                    .expect("stale session request"),
            )
            .await
            .expect("stale session response");
        assert_eq!(stale_session.status(), StatusCode::UNAUTHORIZED);
    }
}
