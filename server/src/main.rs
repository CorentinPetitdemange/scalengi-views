mod admin;
mod auth;
mod config;
mod db;
mod error;
mod models;
mod security;
mod state;

use std::sync::Arc;

use axum::{
    http::{header, HeaderValue, Method},
    routing::{get, patch, post},
    Router,
};
use config::Config;
use state::AppState;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};

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
    let dummy_password_hash = security::hash_password(security::random_token())
        .await
        .expect("dummy password hash");
    let state = AppState {
        pool,
        config: Arc::new(config.clone()),
        dummy_password_hash: Arc::new(dummy_password_hash),
    };
    let app = app(state);
    let listener = tokio::net::TcpListener::bind(config.bind)
        .await
        .expect("bind auth server");
    tracing::info!(address = %config.bind, "Scalengi Views authentication server ready");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("serve auth server");
}

fn app(state: AppState) -> Router {
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
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/auth/bootstrap", get(auth::bootstrap))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/me", get(auth::me).patch(auth::update_profile))
        .route("/api/auth/password", post(auth::change_password))
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/admin/users", get(admin::list_users).post(admin::create_user))
        .route("/api/admin/users/{id}", patch(admin::update_user).delete(admin::delete_user))
        .route("/api/admin/settings/registration", get(admin::registration_setting).patch(admin::update_registration_setting))
        .fallback(|| async { (axum::http::StatusCode::NOT_FOUND, axum::Json(serde_json::json!({"error":{"code":"not_found","message":"Ressource introuvable."}}))) })
        .layer(SetResponseHeaderLayer::if_not_present(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff")))
        .layer(SetResponseHeaderLayer::if_not_present(header::REFERRER_POLICY, HeaderValue::from_static("no-referrer")))
        .layer(SetResponseHeaderLayer::if_not_present(header::CACHE_CONTROL, HeaderValue::from_static("no-store")))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
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
        };
        let pool = db::connect(&database_path).await.expect("test database");
        let dummy_password_hash = security::hash_password(security::random_token())
            .await
            .expect("dummy hash");
        app(AppState {
            pool,
            config: Arc::new(config),
            dummy_password_hash: Arc::new(dummy_password_hash),
        })
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
}
