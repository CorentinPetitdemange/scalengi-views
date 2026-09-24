use std::{env, net::SocketAddr, path::PathBuf};

#[derive(Clone, Debug)]
pub struct Config {
    pub bind: SocketAddr,
    pub database_path: PathBuf,
    pub allowed_origins: Vec<String>,
    pub cookie_secure: bool,
    pub session_lifetime_seconds: i64,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
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

        Ok(Self {
            bind,
            database_path,
            allowed_origins,
            cookie_secure,
            session_lifetime_seconds,
        })
    }
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
