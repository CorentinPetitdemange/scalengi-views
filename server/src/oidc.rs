use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::Redirect,
    Json,
};
use axum_login::AuthSession;
use chrono::Utc;
use openidconnect::{
    core::{CoreAuthenticationFlow, CoreClient, CoreProviderMetadata},
    reqwest, AccessTokenHash, AuthorizationCode, ClientId, ClientSecret, CsrfToken,
    EndpointMaybeSet, EndpointNotSet, EndpointSet, IssuerUrl, Nonce, OAuth2TokenResponse,
    PkceCodeChallenge, PkceCodeVerifier, RedirectUrl, Scope, TokenResponse,
};
use serde::{Deserialize, Serialize};
use sqlx::{Sqlite, Transaction};
use uuid::Uuid;

use crate::{
    auth::{
        authenticate_mutation, authenticated_user, ensure_csrf_token, require_admin,
        require_allowed_origin,
    },
    backend::{find_user_by_id, AuthBackend},
    config::OidcConfig,
    error::ApiError,
    models::UserRecord,
    security::{constant_time_value_matches, normalize_email, random_token},
    state::AppState,
};

const FLOW_SESSION_KEY: &str = "oidc.pending_flow";
const FLOW_MAX_AGE_SECONDS: i64 = 10 * 60;
const SETTINGS_KEY: &str = "oidc_configuration";

type ConfiguredClient = CoreClient<
    EndpointSet,
    EndpointNotSet,
    EndpointNotSet,
    EndpointNotSet,
    EndpointMaybeSet,
    EndpointMaybeSet,
>;

#[derive(Clone)]
pub struct OidcService {
    client: ConfiguredClient,
    http_client: reqwest::Client,
    pub config: OidcConfig,
    issuer: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicOidcConfig {
    pub enabled: bool,
    pub provider_name: Option<String>,
    pub local_login_enabled: bool,
    pub jit_provisioning: bool,
    pub end_session_url: Option<String>,
}

impl PublicOidcConfig {
    pub async fn from_state(state: &AppState) -> Self {
        match state.oidc_service().await {
            Some(service) => Self {
                enabled: true,
                provider_name: Some(service.config.provider_name.clone()),
                local_login_enabled: service.config.local_login_enabled,
                jit_provisioning: service.config.jit_provisioning,
                end_session_url: service.config.end_session_url.clone(),
            },
            None => Self {
                enabled: false,
                provider_name: None,
                local_login_enabled: true,
                jit_provisioning: false,
                end_session_url: None,
            },
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OidcSettings {
    pub enabled: bool,
    pub provider_name: String,
    pub issuer_url: String,
    pub client_id: String,
    pub redirect_url: String,
    pub allowed_domains: Vec<String>,
    pub allow_any_domain: bool,
    pub jit_provisioning: bool,
    pub local_login_enabled: bool,
    pub require_verified_email: bool,
    pub bootstrap_admin_email: Option<String>,
    pub end_session_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminOidcSettings {
    #[serde(flatten)]
    pub settings: OidcSettings,
    pub client_secret_configured: bool,
    pub source: &'static str,
}

impl OidcSettings {
    fn from_runtime(config: &OidcConfig) -> Self {
        Self {
            enabled: true,
            provider_name: config.provider_name.clone(),
            issuer_url: config.issuer_url.clone(),
            client_id: config.client_id.clone(),
            redirect_url: config.redirect_url.clone(),
            allowed_domains: config.allowed_domains.clone(),
            allow_any_domain: config.allow_any_domain,
            jit_provisioning: config.jit_provisioning,
            local_login_enabled: config.local_login_enabled,
            require_verified_email: config.require_verified_email,
            bootstrap_admin_email: config.bootstrap_admin_email.clone(),
            end_session_url: config.end_session_url.clone(),
        }
    }

    fn disabled() -> Self {
        Self {
            enabled: false,
            provider_name: "SSO d’entreprise".into(),
            issuer_url: String::new(),
            client_id: String::new(),
            redirect_url: String::new(),
            allowed_domains: Vec::new(),
            allow_any_domain: false,
            jit_provisioning: false,
            local_login_enabled: true,
            require_verified_email: true,
            bootstrap_admin_email: None,
            end_session_url: None,
        }
    }

    fn validated(
        mut self,
        client_secret: Option<&str>,
    ) -> Result<(Self, Option<OidcConfig>), ApiError> {
        self.provider_name = required_text("providerName", self.provider_name, 100)?;
        self.issuer_url = self.issuer_url.trim().to_owned();
        self.client_id = self.client_id.trim().to_owned();
        self.redirect_url = self.redirect_url.trim().to_owned();
        self.allowed_domains = normalize_domains(self.allowed_domains)?;
        self.bootstrap_admin_email = normalized_optional_email(self.bootstrap_admin_email)?;
        self.end_session_url =
            normalized_optional_text("endSessionUrl", self.end_session_url, 2048)?;
        if !self.enabled {
            return Ok((self, None));
        }
        self.issuer_url = required_text("issuerUrl", self.issuer_url, 2048)?;
        self.client_id = required_text("clientId", self.client_id, 512)?;
        self.redirect_url = required_text("redirectUrl", self.redirect_url, 2048)?;
        if self.allowed_domains.is_empty() && !self.allow_any_domain {
            return Err(ApiError::bad_request(
                "oidc_domain_required",
                "Ajoutez au moins un domaine autorisé ou autorisez explicitement tous les domaines.",
                Some("allowedDomains"),
            ));
        }
        if !self.local_login_enabled && self.bootstrap_admin_email.is_none() {
            return Err(ApiError::bad_request(
                "oidc_bootstrap_admin_required",
                "Une adresse d’administrateur initial est requise avant de désactiver la connexion locale.",
                Some("bootstrapAdminEmail"),
            ));
        }
        let client_secret = client_secret.filter(|value| !value.trim().is_empty()).ok_or_else(|| {
            ApiError::bad_request(
                "oidc_client_secret_missing",
                "Le secret client doit être injecté dans SCALENGI_OIDC_CLIENT_SECRET avant d’activer le SSO.",
                None,
            )
        })?;
        let config = OidcConfig {
            issuer_url: self.issuer_url.clone(),
            client_id: self.client_id.clone(),
            client_secret: client_secret.to_owned(),
            redirect_url: self.redirect_url.clone(),
            provider_name: self.provider_name.clone(),
            allowed_domains: self.allowed_domains.clone(),
            allow_any_domain: self.allow_any_domain,
            jit_provisioning: self.jit_provisioning,
            local_login_enabled: self.local_login_enabled,
            require_verified_email: self.require_verified_email,
            bootstrap_admin_email: self.bootstrap_admin_email.clone(),
            end_session_url: self.end_session_url.clone(),
        };
        validate_oidc_config(&config).map_err(|message| {
            ApiError::bad_request("oidc_configuration_invalid", message, None)
        })?;
        Ok((self, Some(config)))
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct PendingFlow {
    state: String,
    nonce: String,
    pkce_verifier: String,
    return_to: String,
    created_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartQuery {
    return_to: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

impl OidcService {
    pub async fn discover(config: OidcConfig) -> Result<Self, String> {
        validate_oidc_config(&config)?;
        let http_client = reqwest::ClientBuilder::new()
            // OIDC endpoints are controlled by a trusted administrator. Redirects are disabled,
            // as recommended by the openidconnect crate, to keep that network boundary explicit.
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|error| format!("client HTTP OIDC: {error}"))?;
        let issuer_url = IssuerUrl::new(config.issuer_url.clone())
            .map_err(|error| format!("SCALENGI_OIDC_ISSUER_URL invalide: {error}"))?;
        let provider_metadata = CoreProviderMetadata::discover_async(issuer_url, &http_client)
            .await
            .map_err(|error| format!("découverte OIDC impossible: {error}"))?;
        let issuer = provider_metadata.issuer().as_str().to_owned();
        let client = CoreClient::from_provider_metadata(
            provider_metadata,
            ClientId::new(config.client_id.clone()),
            Some(ClientSecret::new(config.client_secret.clone())),
        )
        .set_redirect_uri(
            RedirectUrl::new(config.redirect_url.clone())
                .map_err(|error| format!("SCALENGI_OIDC_REDIRECT_URL invalide: {error}"))?,
        );
        Ok(Self {
            client,
            http_client,
            config,
            issuer,
        })
    }

    #[cfg(test)]
    pub fn for_test(config: OidcConfig) -> Self {
        let provider_metadata: CoreProviderMetadata = serde_json::from_value(serde_json::json!({
            "issuer": config.issuer_url,
            "authorization_endpoint": "https://id.example.com/authorize",
            "token_endpoint": "https://id.example.com/token",
            "jwks_uri": "https://id.example.com/jwks",
            "jwks": {"keys": []},
            "response_types_supported": ["code"],
            "subject_types_supported": ["public"],
            "id_token_signing_alg_values_supported": ["RS256"]
        }))
        .expect("valid test provider metadata");
        let issuer = provider_metadata.issuer().as_str().to_owned();
        let client = CoreClient::from_provider_metadata(
            provider_metadata,
            ClientId::new(config.client_id.clone()),
            Some(ClientSecret::new(config.client_secret.clone())),
        )
        .set_redirect_uri(
            RedirectUrl::new(config.redirect_url.clone()).expect("test redirect URL"),
        );
        let http_client = reqwest::ClientBuilder::new()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("test HTTP client");
        Self {
            client,
            http_client,
            config,
            issuer,
        }
    }
}

pub async fn initialize_service(
    pool: &sqlx::SqlitePool,
    environment_config: Option<OidcConfig>,
    client_secret: Option<&str>,
) -> Result<Option<Arc<OidcService>>, String> {
    let stored = sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
        .bind(SETTINGS_KEY)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("lecture configuration OIDC: {error}"))?;
    let runtime = if let Some(value) = stored {
        let settings: OidcSettings = serde_json::from_str(&value)
            .map_err(|error| format!("configuration OIDC enregistrée invalide: {error}"))?;
        settings
            .validated(client_secret)
            .map_err(|error| format!("configuration OIDC enregistrée: {error}"))?
            .1
    } else {
        environment_config
    };
    match runtime {
        Some(config) => Ok(Some(Arc::new(OidcService::discover(config).await?))),
        None => Ok(None),
    }
}

fn validate_oidc_config(config: &OidcConfig) -> Result<(), String> {
    validate_endpoint_url("URL de l’émetteur", &config.issuer_url)?;
    validate_endpoint_url("URL de retour", &config.redirect_url)?;
    if let Some(end_session_url) = config.end_session_url.as_deref() {
        validate_endpoint_url("URL de déconnexion", end_session_url)?;
    }
    Ok(())
}

fn validate_endpoint_url(label: &str, value: &str) -> Result<(), String> {
    let url = reqwest::Url::parse(value).map_err(|error| format!("{label} invalide: {error}"))?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1"));
    if url.scheme() != "https" && !(url.scheme() == "http" && local) {
        return Err(format!(
            "{label} doit utiliser HTTPS (HTTP est réservé au développement local)"
        ));
    }
    if !url.username().is_empty() || url.password().is_some() || url.fragment().is_some() {
        return Err(format!(
            "{label} ne doit contenir ni identifiants ni fragment"
        ));
    }
    Ok(())
}

fn required_text(
    field: &'static str,
    value: String,
    max_length: usize,
) -> Result<String, ApiError> {
    let value = value.trim().to_owned();
    if value.is_empty() || value.len() > max_length {
        return Err(ApiError::bad_request(
            "oidc_field_invalid",
            format!(
                "Le champ {field} est requis et doit contenir au maximum {max_length} caractères."
            ),
            Some(field),
        ));
    }
    Ok(value)
}

fn normalized_optional_text(
    field: &'static str,
    value: Option<String>,
    max_length: usize,
) -> Result<Option<String>, ApiError> {
    let value = value
        .map(|item| item.trim().to_owned())
        .filter(|item| !item.is_empty());
    if value.as_ref().is_some_and(|item| item.len() > max_length) {
        return Err(ApiError::bad_request(
            "oidc_field_invalid",
            format!("Le champ {field} doit contenir au maximum {max_length} caractères."),
            Some(field),
        ));
    }
    Ok(value)
}

fn normalized_optional_email(value: Option<String>) -> Result<Option<String>, ApiError> {
    value
        .filter(|item| !item.trim().is_empty())
        .map(|item| normalize_email(&item))
        .transpose()
}

fn normalize_domains(domains: Vec<String>) -> Result<Vec<String>, ApiError> {
    let mut normalized = domains
        .into_iter()
        .flat_map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|domain| !domain.is_empty())
                .map(str::to_ascii_lowercase)
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();
    normalized.sort();
    normalized.dedup();
    if normalized.len() > 100
        || normalized.iter().any(|domain| {
            domain.len() > 253
                || domain.starts_with('.')
                || domain.ends_with('.')
                || !domain.contains('.')
                || !domain
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-'))
        })
    {
        return Err(ApiError::bad_request(
            "oidc_domain_invalid",
            "La liste contient un domaine invalide.",
            Some("allowedDomains"),
        ));
    }
    Ok(normalized)
}

pub async fn configuration(State(state): State<AppState>) -> Json<PublicOidcConfig> {
    Json(PublicOidcConfig::from_state(&state).await)
}

pub async fn admin_configuration(
    State(state): State<AppState>,
    auth_session: AuthSession<AuthBackend>,
) -> Result<Json<AdminOidcSettings>, ApiError> {
    let actor = authenticated_user(&auth_session)?;
    require_admin(&actor)?;
    let stored = sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
        .bind(SETTINGS_KEY)
        .fetch_optional(&state.pool)
        .await?;
    let (settings, source) = if let Some(value) = stored {
        (
            serde_json::from_str(&value)
                .map_err(|error| ApiError::Internal(format!("stored OIDC settings: {error}")))?,
            "administration",
        )
    } else if let Some(service) = state.oidc_service().await {
        (OidcSettings::from_runtime(&service.config), "environment")
    } else {
        (OidcSettings::disabled(), "default")
    };
    Ok(Json(AdminOidcSettings {
        settings,
        client_secret_configured: state.config.oidc_client_secret.is_some(),
        source,
    }))
}

pub async fn update_admin_configuration(
    State(state): State<AppState>,
    auth_session: AuthSession<AuthBackend>,
    headers: HeaderMap,
    Json(settings): Json<OidcSettings>,
) -> Result<Json<AdminOidcSettings>, ApiError> {
    require_allowed_origin(&state, &headers)?;
    let actor = authenticate_mutation(&auth_session, &headers).await?;
    require_admin(&actor)?;
    ensure_admin_access_path(&state, &settings).await?;
    let (settings, runtime) = settings.validated(state.config.oidc_client_secret.as_deref())?;
    let service = match runtime {
        Some(config) => Some(Arc::new(OidcService::discover(config).await.map_err(
            |error| {
                ApiError::bad_request(
                    "oidc_discovery_failed",
                    format!("Le fournisseur OIDC n’a pas pu être validé : {error}"),
                    Some("issuerUrl"),
                )
            },
        )?)),
        None => None,
    };
    let value = serde_json::to_string(&settings)
        .map_err(|error| ApiError::Internal(format!("serialize OIDC settings: {error}")))?;
    sqlx::query(
        "INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(SETTINGS_KEY)
    .bind(value)
    .execute(&state.pool)
    .await?;
    *state.oidc.write().await = service;
    Ok(Json(AdminOidcSettings {
        settings,
        client_secret_configured: state.config.oidc_client_secret.is_some(),
        source: "administration",
    }))
}

async fn ensure_admin_access_path(
    state: &AppState,
    settings: &OidcSettings,
) -> Result<(), ApiError> {
    let accessible_admins = if settings.enabled && !settings.local_login_enabled {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1 AND auth_provider IN ('oidc', 'both')",
        )
        .fetch_one(&state.pool)
        .await?
    } else if !settings.enabled {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1 AND auth_provider IN ('local', 'both') AND password_hash <> ''",
        )
        .fetch_one(&state.pool)
        .await?
    } else {
        return Ok(());
    };
    if accessible_admins == 0 {
        return Err(ApiError::conflict(
            "admin_access_required",
            if settings.enabled {
                "Autorisez d’abord le SSO pour au moins un administrateur actif avant de désactiver la connexion locale."
            } else {
                "Conservez au moins un administrateur actif avec un mot de passe local avant de désactiver le SSO."
            },
        ));
    }
    Ok(())
}

pub async fn start(
    State(state): State<AppState>,
    auth_session: AuthSession<AuthBackend>,
    Query(query): Query<StartQuery>,
) -> Result<Redirect, ApiError> {
    let service = state.oidc_service().await.ok_or_else(oidc_disabled)?;
    let return_to = safe_return_path(query.return_to.as_deref()).unwrap_or_else(|| "/".into());
    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();
    let (authorization_url, csrf_state, nonce) = service
        .client
        .authorize_url(
            CoreAuthenticationFlow::AuthorizationCode,
            CsrfToken::new_random,
            Nonce::new_random,
        )
        .add_scope(Scope::new("email".into()))
        .add_scope(Scope::new("profile".into()))
        .set_pkce_challenge(pkce_challenge)
        .url();
    let flow = PendingFlow {
        state: csrf_state.secret().to_owned(),
        nonce: nonce.secret().to_owned(),
        pkce_verifier: pkce_verifier.secret().to_owned(),
        return_to,
        created_at: Utc::now().timestamp(),
    };
    auth_session
        .session
        .insert(FLOW_SESSION_KEY, flow)
        .await
        .map_err(session_error)?;
    Ok(Redirect::to(authorization_url.as_str()))
}

pub async fn callback(
    State(state): State<AppState>,
    auth_session: AuthSession<AuthBackend>,
    Query(query): Query<CallbackQuery>,
) -> Redirect {
    match callback_inner(state, auth_session, query).await {
        Ok(redirect) => redirect,
        Err(error) => {
            let code = error.code();
            tracing::warn!(error = %error, code, "OIDC callback rejected");
            Redirect::to(&format!("/?ssoError={code}"))
        }
    }
}

async fn callback_inner(
    state: AppState,
    mut auth_session: AuthSession<AuthBackend>,
    query: CallbackQuery,
) -> Result<Redirect, ApiError> {
    let service = state.oidc_service().await.ok_or_else(oidc_disabled)?;
    // The flow is consumed before any validation or network request, making callbacks single-use.
    let pending = auth_session
        .session
        .remove::<PendingFlow>(FLOW_SESSION_KEY)
        .await
        .map_err(session_error)?
        .ok_or_else(|| {
            oidc_error(
                "oidc_flow_missing",
                "Connexion SSO expirée ou déjà utilisée.",
            )
        })?;
    if query.error.is_some() {
        return Err(oidc_error(
            "oidc_provider_error",
            "Le fournisseur d’identité a refusé la connexion.",
        ));
    }
    let state_value = query
        .state
        .as_deref()
        .ok_or_else(|| oidc_error("oidc_state_invalid", "État OIDC manquant."))?;
    if !constant_time_value_matches(&pending.state, state_value) {
        return Err(oidc_error("oidc_state_invalid", "État OIDC invalide."));
    }
    if Utc::now().timestamp() - pending.created_at > FLOW_MAX_AGE_SECONDS {
        return Err(oidc_error("oidc_flow_expired", "Connexion SSO expirée."));
    }
    let code = query
        .code
        .filter(|value| !value.is_empty())
        .ok_or_else(|| oidc_error("oidc_code_missing", "Code OIDC manquant."))?;
    let token_response = service
        .client
        .exchange_code(AuthorizationCode::new(code))
        .map_err(|error| ApiError::Internal(format!("configuration échange OIDC: {error}")))?
        .set_pkce_verifier(PkceCodeVerifier::new(pending.pkce_verifier))
        .request_async(&service.http_client)
        .await
        .map_err(|error| {
            tracing::warn!(error = %error, "OIDC token exchange failed");
            oidc_error(
                "oidc_exchange_failed",
                "La connexion SSO n’a pas pu être validée.",
            )
        })?;
    let id_token = token_response.id_token().ok_or_else(|| {
        oidc_error(
            "oidc_id_token_missing",
            "Le fournisseur n’a pas retourné de jeton d’identité.",
        )
    })?;
    let verifier = service.client.id_token_verifier();
    let nonce = Nonce::new(pending.nonce);
    let claims = id_token.claims(&verifier, &nonce).map_err(|error| {
        tracing::warn!(error = %error, "OIDC ID token validation failed");
        oidc_error("oidc_token_invalid", "Le jeton d’identité est invalide.")
    })?;
    if let Some(expected_hash) = claims.access_token_hash() {
        let actual_hash = AccessTokenHash::from_token(
            token_response.access_token(),
            id_token
                .signing_alg()
                .map_err(|error| ApiError::Internal(format!("algorithme OIDC: {error}")))?,
            id_token
                .signing_key(&verifier)
                .map_err(|error| ApiError::Internal(format!("clé OIDC: {error}")))?,
        )
        .map_err(|error| ApiError::Internal(format!("empreinte OIDC: {error}")))?;
        if actual_hash != *expected_hash {
            return Err(oidc_error(
                "oidc_access_token_invalid",
                "Le jeton d’accès OIDC est invalide.",
            ));
        }
    }

    let email = claims.email().map(|value| value.as_str()).ok_or_else(|| {
        oidc_error(
            "oidc_email_missing",
            "Le fournisseur doit fournir l’adresse e-mail.",
        )
    })?;
    let email = validate_sso_email(email, claims.email_verified(), &service.config)?;
    let display_name = claims
        .name()
        .and_then(|claim| claim.get(None))
        .map(|value| value.as_str().trim())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            claims
                .preferred_username()
                .map(|value| value.as_str().trim())
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_else(|| email.split('@').next().unwrap_or(&email));
    let user = resolve_identity(
        &state,
        &service.issuer,
        claims.subject().as_str(),
        &email,
        display_name,
    )
    .await?;
    if auth_session.user.is_some() {
        auth_session
            .session
            .cycle_id()
            .await
            .map_err(session_error)?;
    }
    auth_session.login(&user).await.map_err(auth_error)?;
    let _ = ensure_csrf_token(&auth_session).await?;
    Ok(Redirect::to(&pending.return_to))
}

async fn resolve_identity(
    state: &AppState,
    issuer: &str,
    subject: &str,
    email: &str,
    display_name: &str,
) -> Result<UserRecord, ApiError> {
    let service = state.oidc_service().await.ok_or_else(oidc_disabled)?;
    let now = Utc::now().timestamp();
    let mut transaction = state.pool.begin().await?;
    if let Some(user_id) = sqlx::query_scalar::<_, String>(
        "SELECT user_id FROM oidc_identities WHERE issuer = ? AND subject = ?",
    )
    .bind(issuer)
    .bind(subject)
    .fetch_optional(&mut *transaction)
    .await?
    {
        let mut user = find_user_by_id_in(&mut transaction, &user_id)
            .await?
            .ok_or_else(ApiError::not_found)?;
        if !user.is_active || !matches!(user.auth_provider.as_str(), "oidc" | "both") {
            return Err(oidc_error(
                "oidc_account_inactive",
                "Ce compte n’est pas autorisé à utiliser le SSO.",
            ));
        }
        sqlx::query(
            "UPDATE oidc_identities SET last_login_at = ? WHERE issuer = ? AND subject = ?",
        )
        .bind(now)
        .bind(issuer)
        .bind(subject)
        .execute(&mut *transaction)
        .await?;
        sqlx::query("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(now)
            .bind(&user_id)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        user.last_login_at = Some(now);
        return Ok(user);
    }

    if let Some(user) = find_user_by_email_in(&mut transaction, email).await? {
        if !user.is_active {
            return Err(oidc_error(
                "oidc_account_inactive",
                "Ce compte est désactivé.",
            ));
        }
        if !matches!(user.auth_provider.as_str(), "oidc" | "both") {
            return Err(oidc_error(
                "oidc_link_required",
                "Un administrateur doit autoriser le SSO pour ce compte existant.",
            ));
        }
        insert_identity(&mut transaction, issuer, subject, &user.id, now).await?;
        sqlx::query("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(now)
            .bind(&user.id)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        return find_user_by_id(&state.pool, &user.id)
            .await?
            .ok_or_else(ApiError::not_found);
    }

    let active_admin_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1",
    )
    .fetch_one(&mut *transaction)
    .await?;
    let bootstrap_admin = active_admin_count == 0
        && service
            .config
            .bootstrap_admin_email
            .as_deref()
            .is_some_and(|allowed| allowed.eq_ignore_ascii_case(email));
    if active_admin_count == 0 && service.config.bootstrap_admin_email.is_some() && !bootstrap_admin
    {
        return Err(oidc_error(
            "oidc_bootstrap_admin_required",
            "Le compte administrateur SSO initial doit se connecter en premier.",
        ));
    }
    if !service.config.jit_provisioning && !bootstrap_admin {
        return Err(oidc_error(
            "oidc_account_not_provisioned",
            "Aucun compte Scalengi n’est autorisé pour cette identité.",
        ));
    }
    let id = Uuid::new_v4().to_string();
    let role = if bootstrap_admin { "admin" } else { "member" };
    let session_version = random_token();
    sqlx::query("INSERT INTO users(id, email, display_name, password_hash, auth_provider, session_version, role, is_active, failed_login_attempts, created_at, updated_at, last_login_at) VALUES (?, ?, ?, '', 'oidc', ?, ?, 1, 0, ?, ?, ?)")
        .bind(&id).bind(email).bind(display_name).bind(session_version).bind(role).bind(now).bind(now).bind(now)
        .execute(&mut *transaction).await?;
    insert_identity(&mut transaction, issuer, subject, &id, now).await?;
    if bootstrap_admin {
        sqlx::query("UPDATE settings SET value = 'true' WHERE key = 'bootstrap_claimed'")
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
    find_user_by_id(&state.pool, &id)
        .await?
        .ok_or_else(ApiError::not_found)
}

async fn find_user_by_email_in(
    transaction: &mut Transaction<'_, Sqlite>,
    email: &str,
) -> Result<Option<UserRecord>, ApiError> {
    Ok(
        sqlx::query_as::<_, UserRecord>(crate::models::USER_SELECT_BY_EMAIL)
            .bind(email)
            .fetch_optional(&mut **transaction)
            .await?,
    )
}

async fn find_user_by_id_in(
    transaction: &mut Transaction<'_, Sqlite>,
    id: &str,
) -> Result<Option<UserRecord>, ApiError> {
    Ok(
        sqlx::query_as::<_, UserRecord>(crate::models::USER_SELECT_BY_ID)
            .bind(id)
            .fetch_optional(&mut **transaction)
            .await?,
    )
}

async fn insert_identity(
    transaction: &mut Transaction<'_, Sqlite>,
    issuer: &str,
    subject: &str,
    user_id: &str,
    now: i64,
) -> Result<(), ApiError> {
    sqlx::query("INSERT INTO oidc_identities(issuer, subject, user_id, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)")
        .bind(issuer).bind(subject).bind(user_id).bind(now).bind(now)
        .execute(&mut **transaction).await.map_err(|error| {
            if matches!(&error, sqlx::Error::Database(database) if database.is_unique_violation()) {
                oidc_error("oidc_identity_conflict", "Cette identité SSO est déjà liée à un autre compte.")
            } else {
                error.into()
            }
        })?;
    Ok(())
}

fn validate_sso_email(
    email: &str,
    email_verified: Option<bool>,
    config: &OidcConfig,
) -> Result<String, ApiError> {
    let email = normalize_email(email)?;
    if config.require_verified_email && email_verified != Some(true) {
        return Err(oidc_error(
            "oidc_email_unverified",
            "Le fournisseur n’a pas confirmé cette adresse e-mail.",
        ));
    }
    let domain = email
        .rsplit_once('@')
        .map(|(_, domain)| domain)
        .unwrap_or_default();
    if !config.allow_any_domain
        && !config
            .allowed_domains
            .iter()
            .any(|allowed| allowed.eq_ignore_ascii_case(domain))
    {
        return Err(oidc_error(
            "oidc_domain_forbidden",
            "Le domaine de cette adresse e-mail n’est pas autorisé.",
        ));
    }
    Ok(email)
}

fn safe_return_path(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    (value.starts_with('/')
        && !value.starts_with("//")
        && !value.contains('\\')
        && value.len() <= 2048
        && !value.chars().any(char::is_control))
    .then(|| value.to_owned())
}

fn oidc_disabled() -> ApiError {
    ApiError::Client {
        status: StatusCode::NOT_FOUND,
        code: "oidc_disabled",
        message: "Le SSO n’est pas configuré.".into(),
        field: None,
    }
}

fn oidc_error(code: &'static str, message: &'static str) -> ApiError {
    ApiError::Client {
        status: StatusCode::FORBIDDEN,
        code,
        message: message.into(),
        field: None,
    }
}

fn session_error(error: tower_sessions::session::Error) -> ApiError {
    ApiError::Internal(format!("session: {error}"))
}

fn auth_error(error: axum_login::Error<AuthBackend>) -> ApiError {
    ApiError::Internal(format!("authentication session: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;
    use std::sync::Arc;

    fn config() -> OidcConfig {
        OidcConfig {
            issuer_url: "https://id.example.com".into(),
            client_id: "client".into(),
            client_secret: random_token(),
            redirect_url: "https://app.example.com/api/auth/oidc/callback".into(),
            provider_name: "Example".into(),
            allowed_domains: vec!["example.com".into()],
            allow_any_domain: false,
            jit_provisioning: false,
            local_login_enabled: true,
            require_verified_email: true,
            bootstrap_admin_email: None,
            end_session_url: None,
        }
    }

    #[test]
    fn return_path_rejects_external_and_ambiguous_urls() {
        assert_eq!(
            safe_return_path(Some("/account?tab=sso")),
            Some("/account?tab=sso".into())
        );
        assert_eq!(safe_return_path(Some("https://evil.example")), None);
        assert_eq!(safe_return_path(Some("//evil.example")), None);
        assert_eq!(safe_return_path(Some("/\\evil.example")), None);
        assert_eq!(safe_return_path(Some("/ok\nSet-Cookie:x")), None);
    }

    #[test]
    fn verified_email_and_exact_domain_are_required() {
        let cfg = config();
        assert!(validate_sso_email("USER@EXAMPLE.COM", Some(true), &cfg).is_ok());
        assert!(validate_sso_email("user@sub.example.com", Some(true), &cfg).is_err());
        assert!(validate_sso_email("user@example.com", Some(false), &cfg).is_err());
        assert!(validate_sso_email("user@example.com", None, &cfg).is_err());
    }

    #[test]
    fn oidc_endpoints_require_https_outside_loopback_development() {
        assert!(validate_endpoint_url("issuer", "https://id.example.com").is_ok());
        assert!(validate_endpoint_url("issuer", "http://localhost:8080").is_ok());
        assert!(validate_endpoint_url("issuer", "http://127.0.0.1:8080").is_ok());
        assert!(validate_endpoint_url("issuer", "http://id.example.com").is_err());
        assert!(validate_endpoint_url("issuer", "https://user:pass@id.example.com").is_err());
        assert!(validate_endpoint_url("issuer", "https://id.example.com/#fragment").is_err());
    }

    #[test]
    fn administered_settings_reject_unsafe_activation() {
        let mut settings = OidcSettings::from_runtime(&config());
        let secret = random_token();
        assert!(settings.clone().validated(None).is_err());
        settings.allowed_domains.clear();
        assert!(settings.clone().validated(Some(&secret)).is_err());
        settings.allow_any_domain = true;
        settings.local_login_enabled = false;
        assert!(settings.clone().validated(Some(&secret)).is_err());
        settings.bootstrap_admin_email = Some("ADMIN@EXAMPLE.COM".into());
        let runtime = settings
            .validated(Some(&secret))
            .expect("validated settings")
            .1
            .expect("enabled OIDC");
        assert_eq!(
            runtime.bootstrap_admin_email.as_deref(),
            Some("admin@example.com")
        );
        assert_eq!(runtime.client_secret, secret);
    }

    #[test]
    fn disabled_settings_do_not_require_or_serialize_a_secret() {
        let settings = OidcSettings::disabled();
        assert!(settings
            .clone()
            .validated(None)
            .expect("disabled")
            .1
            .is_none());
        let response = AdminOidcSettings {
            settings,
            client_secret_configured: true,
            source: "environment",
        };
        let secret = random_token();
        let serialized = serde_json::to_string(&response).expect("serialize response");
        assert!(!serialized.contains(&secret));
        assert!(!serialized.contains("clientSecret\""));
        assert!(serialized.contains("clientSecretConfigured"));
    }

    #[tokio::test]
    async fn existing_local_account_requires_explicit_sso_authorization() {
        let database_path =
            std::env::temp_dir().join(format!("scalengi-link-{}.sqlite3", Uuid::new_v4()));
        let pool = crate::db::connect(&database_path).await.expect("database");
        let now = Utc::now().timestamp();
        let user_id = Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO users(id, email, display_name, password_hash, auth_provider, session_version, role, is_active, created_at, updated_at) VALUES (?, 'alice@example.com', 'Alice', ?, 'local', ?, 'member', 1, ?, ?)")
            .bind(&user_id).bind(random_token()).bind(random_token()).bind(now).bind(now).execute(&pool).await.expect("user");
        let oidc_config = config();
        let state = AppState {
            pool: pool.clone(),
            config: Arc::new(Config {
                bind: "127.0.0.1:0".parse().expect("bind"),
                database_path,
                allowed_origins: vec![],
                cookie_secure: false,
                session_lifetime_seconds: 3600,
                oidc: Some(oidc_config.clone()),
                oidc_client_secret: Some(oidc_config.client_secret.clone()),
                installation_profile: crate::config::InstallationProfile::Standard,
                installation_profile_explicit: false,
            }),
            oidc: Arc::new(tokio::sync::RwLock::new(Some(Arc::new(
                OidcService::for_test(oidc_config),
            )))),
        };

        let rejected = resolve_identity(
            &state,
            "https://id.example.com",
            "subject-1",
            "alice@example.com",
            "Alice",
        )
        .await
        .expect_err("local account must not be linked silently");
        assert_eq!(rejected.code(), "oidc_link_required");

        sqlx::query("UPDATE users SET auth_provider = 'both' WHERE id = ?")
            .bind(&user_id)
            .execute(&pool)
            .await
            .expect("authorize SSO");
        let linked = resolve_identity(
            &state,
            "https://id.example.com",
            "subject-1",
            "alice@example.com",
            "Alice",
        )
        .await
        .expect("authorized link");
        assert_eq!(linked.id, user_id);
        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM oidc_identities")
                .fetch_one(&pool)
                .await
                .expect("identity count"),
            1
        );

        sqlx::query("UPDATE users SET auth_provider = 'local' WHERE id = ?")
            .bind(&user_id)
            .execute(&pool)
            .await
            .expect("revoke SSO");
        let revoked = resolve_identity(
            &state,
            "https://id.example.com",
            "subject-1",
            "alice@example.com",
            "Alice",
        )
        .await
        .expect_err("linked identity must respect a later SSO revocation");
        assert_eq!(revoked.code(), "oidc_account_inactive");
    }

    #[tokio::test]
    async fn sso_bootstrap_is_exact_and_jit_users_never_become_admins() {
        let database_path = std::env::temp_dir().join(format!(
            "scalengi-oidc-bootstrap-{}.sqlite3",
            Uuid::new_v4()
        ));
        let pool = crate::db::connect(&database_path).await.expect("database");
        let mut oidc_config = config();
        oidc_config.jit_provisioning = true;
        oidc_config.bootstrap_admin_email = Some("admin@example.com".into());
        let state = AppState {
            pool: pool.clone(),
            config: Arc::new(Config {
                bind: "127.0.0.1:0".parse().expect("bind"),
                database_path,
                allowed_origins: vec![],
                cookie_secure: false,
                session_lifetime_seconds: 3600,
                oidc: Some(oidc_config.clone()),
                oidc_client_secret: Some(oidc_config.client_secret.clone()),
                installation_profile: crate::config::InstallationProfile::Standard,
                installation_profile_explicit: false,
            }),
            oidc: Arc::new(tokio::sync::RwLock::new(Some(Arc::new(
                OidcService::for_test(oidc_config),
            )))),
        };

        let premature = resolve_identity(
            &state,
            "https://id.example.com",
            "member-before-admin",
            "member@example.com",
            "Member",
        )
        .await
        .expect_err("bootstrap administrator must authenticate first");
        assert_eq!(premature.code(), "oidc_bootstrap_admin_required");

        let admin = resolve_identity(
            &state,
            "https://id.example.com",
            "admin-subject",
            "admin@example.com",
            "Administrator",
        )
        .await
        .expect("bootstrap administrator");
        assert_eq!(admin.role, "admin");

        let member = resolve_identity(
            &state,
            "https://id.example.com",
            "member-subject",
            "member@example.com",
            "Member",
        )
        .await
        .expect("JIT member");
        assert_eq!(member.role, "member");

        let same_identity = resolve_identity(
            &state,
            "https://id.example.com",
            "admin-subject",
            "renamed@example.com",
            "Renamed",
        )
        .await
        .expect("known immutable identity");
        assert_eq!(same_identity.id, admin.id);
        assert_eq!(same_identity.email, "admin@example.com");
    }
}
