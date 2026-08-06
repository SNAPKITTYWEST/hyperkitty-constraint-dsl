//! P4 Gate: NO_TELEMETRY
//! Detects analytics domains, tracking pixels, sendBeacon, and unauthorized external requests

/// Telemetry detection patterns
const TELEMETRY_PATTERNS: &[&str] = &[
    "google-analytics",
    "analytics.google",
    "gtag",
    "ga.js",
    "mixpanel",
    "segment.com",
    "amplitude",
    "heap.io",
    "intercom",
    "fullstory",
    "datadog",
    "new relic",
    "sentry.io",
    "crashlytics",
    "firebase",
    "hotjar",
    "inspectlet",
    "mouseflow",
    "kissmetrics",
    "optimizely",
];

/// Allowlisted external domains (non-telemetry)
const ALLOWLISTED_DOMAINS: &[&str] = &[
    "github.com",
    "api.github.com",
    "raw.githubusercontent.com",
    "npm.org",
    "registry.npmjs.org",
    "crates.io",
    "docs.rs",
    "locahost",
    "127.0.0.1",
];

/// Check artifact for telemetry usage
///
/// Returns (passed, findings)
/// - passed: true if no telemetry detected
/// - findings: vector of violation descriptions
pub fn check_telemetry(artifact: &str) -> (bool, Vec<String>) {
    let mut findings = Vec::new();

    // Check 1: sendBeacon usage
    if artifact.contains("sendBeacon") {
        findings.push("sendBeacon() detected - potential telemetry".to_string());
    }

    // Check 2: Analytics domain patterns
    let artifact_lower = artifact.to_lowercase();
    for pattern in TELEMETRY_PATTERNS {
        if artifact_lower.contains(pattern) {
            findings.push(format!("Telemetry pattern '{}' detected", pattern));
        }
    }

    // Check 3: 1x1 tracking pixels (various formats)
    if (artifact.contains("1x1") || artifact.contains("1\"") || artifact.contains("1'")) &&
       (artifact.contains("gif") || artifact.contains("pixel") || artifact.contains("width") || artifact.contains("height")) {
        findings.push("Tracking pixel (1x1 gif/image) detected".to_string());
    }

    // Check 4: External HTTP requests
    check_external_requests(artifact, &mut findings);

    let passed = findings.is_empty();
    (passed, findings)
}

fn check_external_requests(artifact: &str, findings: &mut Vec<String>) {
    // Match http:// or https:// followed by domain
    let mut chars = artifact.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == 'h' && chars.peek() == Some(&'t') {
            // Check if it's http:// or https://
            let pos = artifact.find("http://").or_else(|| artifact.find("https://"));
            if let Some(start) = pos {
                if let Some(end) = artifact[start..].find(|c: char| c.is_whitespace() || c == '"' || c == '\'' || c == ')') {
                    let url = &artifact[start..start + end];
                    if !is_allowlisted(url) && !url.contains("localhost") && !url.contains("127.0.0.1") {
                        findings.push(format!("External request to non-allowlisted domain: {}", url));
                    }
                }
            }
        }
    }
}

fn is_allowlisted(url: &str) -> bool {
    for domain in ALLOWLISTED_DOMAINS {
        if url.contains(domain) {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_sendbeacon() {
        let artifact = "navigator.sendBeacon('/api/track', data);";
        let (passed, findings) = check_telemetry(artifact);
        assert!(!passed);
        assert!(findings.iter().any(|f| f.contains("sendBeacon")));
    }

    #[test]
    fn test_detect_google_analytics() {
        let artifact = "<!-- Google Analytics -->\nscript src='//www.google-analytics.com/ga.js'";
        let (passed, findings) = check_telemetry(artifact);
        assert!(!passed);
        assert!(findings.iter().any(|f| f.contains("google") || f.contains("gtag")));
    }

    #[test]
    fn test_detect_mixpanel() {
        let artifact = "mixpanel.track('user_login', { user_id: 123 });";
        let (passed, findings) = check_telemetry(artifact);
        assert!(!passed);
        assert!(findings.iter().any(|f| f.contains("mixpanel")));
    }

    #[test]
    fn test_detect_tracking_pixel() {
        let artifact = "<img src='track.gif' width='1' height='1' />";
        let (passed, findings) = check_telemetry(artifact);
        assert!(!passed);
        assert!(findings.iter().any(|f| f.contains("pixel")));
    }

    #[test]
    fn test_external_request_allowlisted() {
        let artifact = "fetch('https://api.github.com/repos');";
        let (passed, _findings) = check_telemetry(artifact);
        assert!(passed);
    }

    #[test]
    fn test_external_request_non_allowlisted() {
        let artifact = "fetch('https://external-tracker.com/log');";
        let (passed, findings) = check_telemetry(artifact);
        assert!(!passed);
        assert!(findings.iter().any(|f| f.contains("External request")));
    }

    #[test]
    fn test_clean_code() {
        let artifact = r#"
            function logMessage(msg) {
                console.log(msg);
            }
            logMessage("Hello world");
        "#;
        let (passed, findings) = check_telemetry(artifact);
        assert!(passed);
        assert!(findings.is_empty());
    }

    #[test]
    fn test_firebase_detection() {
        let artifact = "firebase.analytics().logEvent('page_view');";
        let (passed, findings) = check_telemetry(artifact);
        assert!(!passed);
        assert!(findings.iter().any(|f| f.contains("firebase")));
    }
}
