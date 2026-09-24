use std::sync::Arc;

use sqlx::SqlitePool;
use tokio::sync::RwLock;

use crate::{config::Config, oidc::OidcService};

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub config: Arc<Config>,
    pub oidc: Arc<RwLock<Option<Arc<OidcService>>>>,
}

impl AppState {
    pub async fn oidc_service(&self) -> Option<Arc<OidcService>> {
        self.oidc.read().await.clone()
    }
}
