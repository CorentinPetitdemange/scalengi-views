use openidconnect::CsrfToken;
use subtle::ConstantTimeEq;

use crate::error::ApiError;

pub async fn hash_password(password: String) -> Result<String, ApiError> {
    tokio::task::spawn_blocking(move || password_auth::generate_hash(password))
        .await
        .map_err(|error| ApiError::Internal(format!("password task failed: {error}")))
}

pub async fn verify_password(password: String, encoded: String) -> bool {
    tokio::task::spawn_blocking(move || password_auth::verify_password(password, &encoded).is_ok())
        .await
        .unwrap_or(false)
}

pub fn random_token() -> String {
    CsrfToken::new_random().secret().to_owned()
}

pub fn constant_time_value_matches(expected: &str, provided: &str) -> bool {
    expected.len() == provided.len() && bool::from(expected.as_bytes().ct_eq(provided.as_bytes()))
}

pub fn normalize_email(value: &str) -> Result<String, ApiError> {
    let email = value.trim().to_lowercase();
    let valid = email.len() <= 254
        && !email.chars().any(char::is_whitespace)
        && email.split_once('@').is_some_and(|(local, domain)| {
            !local.is_empty()
                && local.len() <= 64
                && domain.contains('.')
                && !domain.starts_with('.')
                && !domain.ends_with('.')
        });
    if !valid {
        return Err(ApiError::bad_request(
            "invalid_email",
            "Adresse e-mail invalide.",
            Some("email"),
        ));
    }
    Ok(email)
}

pub fn validate_display_name(value: &str) -> Result<String, ApiError> {
    let name = value.trim();
    if !(2..=100).contains(&name.chars().count()) || name.chars().any(char::is_control) {
        return Err(ApiError::bad_request(
            "invalid_display_name",
            "Le nom doit contenir entre 2 et 100 caractères.",
            Some("displayName"),
        ));
    }
    Ok(name.to_owned())
}

pub fn validate_password(value: &str, email: &str) -> Result<(), ApiError> {
    let has_upper = value.chars().any(char::is_uppercase);
    let has_lower = value.chars().any(char::is_lowercase);
    let has_digit = value.chars().any(|character| character.is_ascii_digit());
    let has_symbol = value.chars().any(|character| !character.is_alphanumeric());
    let local = email.split('@').next().unwrap_or_default();
    if !(12..=128).contains(&value.chars().count())
        || !has_upper
        || !has_lower
        || !has_digit
        || !has_symbol
    {
        return Err(ApiError::bad_request(
            "weak_password",
            "Le mot de passe doit contenir 12 à 128 caractères, avec majuscule, minuscule, chiffre et symbole.",
            Some("password"),
        ));
    }
    if local.len() >= 4 && value.to_lowercase().contains(&local.to_lowercase()) {
        return Err(ApiError::bad_request(
            "weak_password",
            "Le mot de passe ne doit pas contenir l’adresse e-mail.",
            Some("password"),
        ));
    }
    Ok(())
}

pub fn validate_role(value: &str) -> Result<&str, ApiError> {
    match value {
        "admin" | "member" => Ok(value),
        _ => Err(ApiError::bad_request(
            "invalid_role",
            "Rôle invalide.",
            Some("role"),
        )),
    }
}

pub fn validate_auth_provider(value: &str, oidc_enabled: bool) -> Result<&str, ApiError> {
    match value {
        "local" => Ok(value),
        "oidc" | "both" if oidc_enabled => Ok(value),
        "oidc" | "both" => Err(ApiError::bad_request(
            "oidc_disabled",
            "OIDC doit être configuré avant d’affecter ce mode de connexion.",
            Some("authProvider"),
        )),
        _ => Err(ApiError::bad_request(
            "invalid_auth_provider",
            "Mode d’authentification invalide.",
            Some("authProvider"),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_policy_rejects_weak_and_identity_passwords() {
        assert!(validate_password("short", "alice@example.com").is_err());
        assert!(validate_password("Alice-Example-42!", "alice@example.com").is_err());
        assert!(validate_password("Correct-Horse-42!", "alice@example.com").is_ok());
    }

    #[test]
    fn token_comparison_is_constant_time() {
        let token = random_token();
        assert!(constant_time_value_matches(&token, &token));
        assert!(!constant_time_value_matches(&token, "another-token"));
    }
}
