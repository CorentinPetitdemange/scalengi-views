use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand::{rngs::OsRng, RngCore};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

use crate::error::ApiError;

pub const SESSION_COOKIE: &str = "scalengi_session";

pub async fn hash_password(password: String) -> Result<String, ApiError> {
    tokio::task::spawn_blocking(move || {
        let salt = SaltString::generate(&mut OsRng);
        Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|error| ApiError::Internal(format!("password hashing failed: {error}")))
    })
    .await
    .map_err(|error| ApiError::Internal(format!("password task failed: {error}")))?
}

pub async fn verify_password(password: String, encoded: String) -> bool {
    tokio::task::spawn_blocking(move || {
        PasswordHash::new(&encoded).ok().is_some_and(|hash| {
            Argon2::default()
                .verify_password(password.as_bytes(), &hash)
                .is_ok()
        })
    })
    .await
    .unwrap_or(false)
}

pub fn random_token() -> String {
    let mut bytes = [0_u8; 32];
    OsRng.fill_bytes(&mut bytes);
    hex(&bytes)
}

pub fn token_hash(token: &str) -> String {
    hex(&Sha256::digest(token.as_bytes()))
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

fn hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
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
    fn token_comparison_is_hash_based() {
        let token = random_token();
        let hash = token_hash(&token);
        assert_eq!(hash, token_hash(&token));
        assert_ne!(hash, token_hash("another-token"));
    }
}
