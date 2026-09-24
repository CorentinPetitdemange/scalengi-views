use std::sync::Arc;

use sqlx::SqlitePool;

use crate::{config::Config, oidc::OidcService};

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub config: Arc<Config>,
    pub oidc: Option<Arc<OidcService>>,
}
