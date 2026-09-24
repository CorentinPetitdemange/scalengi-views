use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{message}")]
    Client {
        status: StatusCode,
        code: &'static str,
        message: String,
        field: Option<&'static str>,
    },
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error("internal error: {0}")]
    Internal(String),
}

#[derive(Serialize)]
struct ErrorEnvelope {
    error: ErrorBody,
}

#[derive(Serialize)]
struct ErrorBody {
    code: &'static str,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    field: Option<&'static str>,
}

impl ApiError {
    pub fn bad_request(
        code: &'static str,
        message: impl Into<String>,
        field: Option<&'static str>,
    ) -> Self {
        Self::Client {
            status: StatusCode::BAD_REQUEST,
            code,
            message: message.into(),
            field,
        }
    }

    pub fn unauthorized() -> Self {
        Self::Client {
            status: StatusCode::UNAUTHORIZED,
            code: "unauthorized",
            message: "Authentification requise.".into(),
            field: None,
        }
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::Client {
            status: StatusCode::FORBIDDEN,
            code: "forbidden",
            message: message.into(),
            field: None,
        }
    }

    pub fn conflict(code: &'static str, message: impl Into<String>) -> Self {
        Self::Client {
            status: StatusCode::CONFLICT,
            code,
            message: message.into(),
            field: None,
        }
    }

    pub fn not_found() -> Self {
        Self::Client {
            status: StatusCode::NOT_FOUND,
            code: "not_found",
            message: "Ressource introuvable.".into(),
            field: None,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message, field) = match self {
            Self::Client {
                status,
                code,
                message,
                field,
            } => (status, code, message, field),
            Self::Database(error) => {
                tracing::error!(error = %error, "database request failed");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal_error",
                    "Une erreur interne est survenue.".into(),
                    None,
                )
            }
            Self::Internal(error) => {
                tracing::error!(error = %error, "internal request failed");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal_error",
                    "Une erreur interne est survenue.".into(),
                    None,
                )
            }
        };
        (
            status,
            Json(ErrorEnvelope {
                error: ErrorBody {
                    code,
                    message,
                    field,
                },
            }),
        )
            .into_response()
    }
}
