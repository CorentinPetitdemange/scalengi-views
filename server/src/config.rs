use std::{env, fs, net::SocketAddr, path::PathBuf};

use serde::Serialize;

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum InstallationProfile {
    #[default]
    Standard,
    Demo,
}

impl InstallationProfile {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Standard => "standard",
            Self::Demo => "demo",
        }
    }

    pub fn parse(value: &str) -> Result<Self, String> {
        match value.trim().to_ascii_lowercase().as_str() {
            "standard" => Ok(Self::Standard),
            "demo" => Ok(Self::Demo),
            _ => Err("SCALENGI_INSTALLATION_PROFILE doit valoir standard ou demo".into()),
        }
    }
}

#[derive(Clone)]
pub struct DemoAdminConfig {
    pub email: String,
    pub display_name: String,
}

impl DemoAdminConfig {
    pub fn from_env(profile: InstallationProfile) -> Result<Option<Self>, String> {
        let email = optional("SCALENGI_DEMO_ADMIN_EMAIL");
        let display_name = optional("SCALENGI_DEMO_ADMIN_DISPLAY_NAME")
            .unwrap_or_else(|| "Administrateur démo".into());
        let demo_admin = email.map(|email| Self {
            email,
            display_name,
        });
        if profile != InstallationProfile::Demo && demo_admin.is_some() {
            return Err(
                "les identifiants SCALENGI_DEMO_ADMIN_* sont réservés au profil demo".into(),
            );
        }
        Ok(demo_admin)
    }
}

#[derive(Clone)]
pub struct Config {
    pub bind: SocketAddr,
    pub database_path: PathBuf,
    pub allowed_origins: Vec<String>,
    pub cookie_secure: bool,
    pub session_lifetime_seconds: i64,
    pub oidc: Option<OidcConfig>,
    pub oidc_client_secret: Option<String>,
    pub installation_profile: InstallationProfile,
    pub installation_profile_explicit: bool,
}

#[derive(Clone)]
pub struct OidcConfig {
    pub issuer_url: String,
    pub client_id: String,
    pub client_secret: String,
    pub redirect_url: String,
    pub provider_name: String,
    pub allowed_domains: Vec<String>,
    pub allow_any_domain: bool,
    pub jit_provisioning: bool,
    pub local_login_enabled: bool,
    pub require_verified_email: bool,
    pub bootstrap_admin_email: Option<String>,
    pub end_session_url: Option<String>,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let raw_installation_profile = optional("SCALENGI_INSTALLATION_PROFILE");
        let installation_profile_explicit = raw_installation_profile.is_some();
        let installation_profile = raw_installation_profile
            .as_deref()
            .map(InstallationProfile::parse)
            .transpose()?
            .unwrap_or_default();
        let bind = env::var("SCALENGI_AUTH_BIND")
            .unwrap_or_else(|_| "127.0.0.1:8787".into())
            .parse()
            .map_err(|error| format!("SCALENGI_AUTH_BIND invalide: {error}"))?;
        let database_path = PathBuf::from(
            env::var("SCALENGI_AUTH_DATABASE_PATH")
                .unwrap_or_else(|_| "data/scalengi-auth.sqlite3".into()),
        );
        let allowed_origins = env::var("SCALENGI_AUTH_ALLOWED_ORIGINS")
            .unwrap_or_else(|_| {
                "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:1420,tauri://localhost,http://tauri.localhost".into()
            })
            .split(',')
            .map(str::trim)
            .filter(|origin| !origin.is_empty())
            .map(str::to_owned)
            .collect();
        let cookie_secure = parse_bool("SCALENGI_AUTH_COOKIE_SECURE", false)?;
        let session_lifetime_seconds = env::var("SCALENGI_AUTH_SESSION_HOURS")
            .unwrap_or_else(|_| "8".into())
            .parse::<i64>()
            .map_err(|error| format!("SCALENGI_AUTH_SESSION_HOURS invalide: {error}"))?
            .clamp(1, 168)
            * 3600;
        let oidc_client_secret = optional("SCALENGI_OIDC_CLIENT_SECRET");
        let oidc = if parse_bool("SCALENGI_OIDC_ENABLED", false)? {
            let allowed_domains = csv("SCALENGI_OIDC_ALLOWED_DOMAINS")
                .into_iter()
                .map(|domain| domain.to_ascii_lowercase())
                .collect::<Vec<_>>();
            let allow_any_domain = parse_bool("SCALENGI_OIDC_ALLOW_ANY_DOMAIN", false)?;
            if allowed_domains.is_empty() && !allow_any_domain {
                return Err("SCALENGI_OIDC_ALLOWED_DOMAINS est requis quand OIDC est activé (ou définissez explicitement SCALENGI_OIDC_ALLOW_ANY_DOMAIN=true)".into());
            }
            let local_login_enabled = parse_bool("SCALENGI_OIDC_LOCAL_LOGIN_ENABLED", true)?;
            let bootstrap_admin_email = optional("SCALENGI_OIDC_BOOTSTRAP_ADMIN_EMAIL")
                .map(|value| value.to_ascii_lowercase());
            if !local_login_enabled && bootstrap_admin_email.is_none() {
                return Err("SCALENGI_OIDC_BOOTSTRAP_ADMIN_EMAIL est requis lorsque la connexion locale est désactivée".into());
            }
            Some(OidcConfig {
                issuer_url: required("SCALENGI_OIDC_ISSUER_URL")?,
                client_id: required("SCALENGI_OIDC_CLIENT_ID")?,
                client_secret: oidc_client_secret.clone().ok_or_else(|| {
                    "SCALENGI_OIDC_CLIENT_SECRET est requis quand OIDC est activé".to_owned()
                })?,
                redirect_url: required("SCALENGI_OIDC_REDIRECT_URL")?,
                provider_name: env::var("SCALENGI_OIDC_PROVIDER_NAME")
                    .unwrap_or_else(|_| "SSO d’entreprise".into()),
                allowed_domains,
                allow_any_domain,
                jit_provisioning: parse_bool("SCALENGI_OIDC_JIT_PROVISIONING", false)?,
                local_login_enabled,
                require_verified_email: parse_bool("SCALENGI_OIDC_REQUIRE_VERIFIED_EMAIL", true)?,
                bootstrap_admin_email,
                end_session_url: optional("SCALENGI_OIDC_END_SESSION_URL"),
            })
        } else {
            None
        };
        if installation_profile == InstallationProfile::Demo
            && oidc
                .as_ref()
                .is_some_and(|configuration| !configuration.local_login_enabled)
        {
            return Err("le profil demo exige que la connexion locale reste activée".into());
        }

        Ok(Self {
            bind,
            database_path,
            allowed_origins,
            cookie_secure,
            session_lifetime_seconds,
            oidc,
            oidc_client_secret,
            installation_profile,
            installation_profile_explicit,
        })
    }
}

pub fn demo_admin_password_from_env() -> Result<Option<String>, String> {
    let direct = env::var("SCALENGI_DEMO_ADMIN_PASSWORD").ok();
    let file = optional("SCALENGI_DEMO_ADMIN_PASSWORD_FILE");
    if direct.is_some() && file.is_some() {
        return Err("configurez soit SCALENGI_DEMO_ADMIN_PASSWORD, soit SCALENGI_DEMO_ADMIN_PASSWORD_FILE, jamais les deux".into());
    }
    if let Some(path) = file {
        let metadata = fs::metadata(&path)
            .map_err(|error| format!("SCALENGI_DEMO_ADMIN_PASSWORD_FILE illisible: {error}"))?;
        if !metadata.is_file() || metadata.len() > 1024 {
            return Err(
                "SCALENGI_DEMO_ADMIN_PASSWORD_FILE doit être un fichier régulier de 1 Kio maximum"
                    .into(),
            );
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if metadata.permissions().mode() & 0o077 != 0 {
                return Err("SCALENGI_DEMO_ADMIN_PASSWORD_FILE ne doit être lisible que par son propriétaire (mode 0600)".into());
            }
        }
        let password = fs::read_to_string(&path)
            .map_err(|error| format!("SCALENGI_DEMO_ADMIN_PASSWORD_FILE illisible: {error}"))?
            .trim_end_matches(['\r', '\n'])
            .to_owned();
        return Ok(Some(password));
    }
    Ok(direct.filter(|value| !value.is_empty()))
}

fn required(key: &str) -> Result<String, String> {
    optional(key).ok_or_else(|| format!("{key} est requis quand OIDC est activé"))
}

fn optional(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn csv(key: &str) -> Vec<String> {
    optional(key)
        .into_iter()
        .flat_map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .map(str::to_owned)
                .collect::<Vec<_>>()
        })
        .collect()
}

fn parse_bool(key: &str, default: bool) -> Result<bool, String> {
    match env::var(key) {
        Ok(value) if matches!(value.to_ascii_lowercase().as_str(), "1" | "true" | "yes") => {
            Ok(true)
        }
        Ok(value) if matches!(value.to_ascii_lowercase().as_str(), "0" | "false" | "no") => {
            Ok(false)
        }
        Ok(_) => Err(format!("{key} doit valoir true ou false")),
        Err(_) => Ok(default),
    }
}
