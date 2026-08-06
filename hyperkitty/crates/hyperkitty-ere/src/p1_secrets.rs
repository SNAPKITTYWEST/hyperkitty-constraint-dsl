//! P1 Gate: NO_SECRETS
//! Detects hardcoded credentials, API keys, and secrets

use regex::Regex;
use std::sync::OnceLock;

/// AWS access key pattern: AKIA + 16 alphanumeric
fn aws_key_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"AKIA[0-9A-Z]{16}").expect("Valid regex"))
}

/// Stripe secret key patterns
fn stripe_sk_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"sk_(?:live|test)_[A-Za-z0-9_]{20,}").expect("Valid regex"))
}

/// GitHub token patterns
fn github_token_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"(?i)ghp_[A-Za-z0-9_]{15,}").expect("Valid regex"))
}

/// Private key markers (RSA, OPENSSH, EC, DSA, etc.)
fn private_key_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"-----BEGIN\s*(PRIVATE|RSA|OPENSSH|EC|DSA|PGP|ENCRYPTED)\s*KEY").expect("Valid regex")
    })
}

/// Password assignment patterns (plaintext)
fn password_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r#"(?i)password\s*[:=]\s*['""]?[A-Za-z0-9!@#$%^&*()_\-+=\[\]{}<>]{8,}['""]?"#).expect("Valid regex")
    })
}

/// API key generic patterns
fn api_key_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r#"(?i)api[-_]?key\s*[:=]\s*['""]?[A-Za-z0-9\-_]{8,}['""]?"#).expect("Valid regex")
    })
}

/// Bearer token pattern
fn bearer_token_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"(?i)bearer\s+[A-Za-z0-9\-._~+/]+=*").expect("Valid regex")
    })
}

/// JWT pattern (basic detection)
fn jwt_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}").expect("Valid regex")
    })
}

/// Generic secret value patterns (env-like)
fn env_secret_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r#"(?i)(secret|token|key)\s*[:=]\s*['"]([A-Za-z0-9\-_./+=]{20,})['"]"#).expect("Valid regex")
    })
}

/// Check artifact for exposed secrets
///
/// Returns (passed, findings)
/// - passed: true if no secrets detected
/// - findings: vector of violation descriptions with line numbers
pub fn check_secrets(artifact: &str) -> (bool, Vec<String>) {
    let mut findings = Vec::new();

    for (line_num, line) in artifact.lines().enumerate() {
        let line_no = line_num + 1;

        // AWS keys
        if aws_key_regex().is_match(line) {
            findings.push(format!("Line {}: AWS access key detected (AKIA...)", line_no));
        }

        // Stripe keys
        if stripe_sk_regex().is_match(line) {
            findings.push(format!("Line {}: Stripe secret key detected (sk_live/sk_test)", line_no));
        }

        // GitHub tokens
        if github_token_regex().is_match(line) {
            findings.push(format!("Line {}: GitHub personal access token detected (ghp_...)", line_no));
        }

        // Private keys
        if private_key_regex().is_match(line) {
            findings.push(format!("Line {}: Private key marker detected (-----BEGIN PRIVATE/RSA/OPENSSH KEY)", line_no));
        }

        // Passwords
        if password_regex().is_match(line) {
            findings.push(format!("Line {}: Password in plaintext detected (password=...)", line_no));
        }

        // Generic API keys
        if api_key_regex().is_match(line) {
            findings.push(format!("Line {}: API key pattern detected (api_key=...)", line_no));
        }

        // Bearer tokens
        if bearer_token_regex().is_match(line) {
            findings.push(format!("Line {}: Bearer token detected", line_no));
        }

        // JWT tokens
        if jwt_regex().is_match(line) {
            findings.push(format!("Line {}: JWT token detected", line_no));
        }

        // Generic env secrets
        if env_secret_regex().is_match(line) {
            findings.push(format!("Line {}: Environment secret pattern detected", line_no));
        }
    }

    let passed = findings.is_empty();
    (passed, findings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_aws_key() {
        let artifact = "const AWS_KEY = 'AKIAIOSFODNN7EXAMPLE'";
        let (passed, findings) = check_secrets(artifact);
        assert!(!passed);
        assert!(!findings.is_empty());
        assert!(findings[0].contains("AWS access key"));
    }

    #[test]
    fn test_detect_private_key() {
        let artifact = "-----BEGIN PRIVATE KEY\nMIIEvQIBADANBgkqhkiG9w0BAQE";
        let (passed, findings) = check_secrets(artifact);
        assert!(!passed);
        assert!(!findings.is_empty());
        assert!(findings[0].contains("Private key"));
    }

    #[test]
    fn test_detect_github_token() {
        let artifact = "export GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuv";
        let (passed, findings) = check_secrets(artifact);
        assert!(!passed);
        assert!(!findings.is_empty());
        assert!(findings[0].contains("GitHub"));
    }

    #[test]
    fn test_detect_stripe_key() {
        let artifact = "stripe_key: 'sk_live_51234567890abcdefghijk'";
        let (passed, findings) = check_secrets(artifact);
        assert!(!passed);
        assert!(!findings.is_empty());
        assert!(findings[0].contains("Stripe"));
    }

    #[test]
    fn test_detect_password_pattern() {
        let artifact = "password = 'SuperSecret123!'";
        let (passed, findings) = check_secrets(artifact);
        assert!(!passed);
        assert!(!findings.is_empty());
        assert!(findings[0].contains("Password"));
    }

    #[test]
    fn test_no_secrets_found() {
        let artifact = "fn hello_world() {\n    println!(\"Hello, world!\");\n}";
        let (passed, findings) = check_secrets(artifact);
        assert!(passed);
        assert!(findings.is_empty());
    }

    #[test]
    fn test_line_numbers_in_findings() {
        let artifact = "line 1\nline 2\nline 3 AKIAIOSFODNN7EXAMPLE\nline 4";
        let (passed, findings) = check_secrets(artifact);
        assert!(!passed);
        assert!(findings[0].contains("Line 3"));
    }

    #[test]
    fn test_jwt_detection() {
        let artifact = "token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP5THx5D8'";
        let (passed, findings) = check_secrets(artifact);
        assert!(!passed);
        assert!(!findings.is_empty());
        assert!(findings[0].contains("JWT"));
    }
}
