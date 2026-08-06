//! HyperKitty ERE - Execution Regulation Engine
//!
//! Five-gate proof protocol for code safety:
//! - P1: NO_SECRETS - detects hardcoded credentials
//! - P2: NO_EVAL - detects dynamic code execution
//! - P3: NO_INFINITE_LOOPS - detects unbounded iteration
//! - P4: NO_TELEMETRY - detects analytics and tracking
//! - P5: AUDIT_HASH - issues receipts when all gates pass

pub mod p1_secrets;
pub mod p2_eval;
pub mod p3_loops;
pub mod p4_telemetry;
pub mod p5_hash;

pub use p5_hash::EreReceipt;
pub use hyperkitty_core::Result;

/// Gate check result: (passed, findings)
pub type GateResult = (bool, Vec<String>);

/// Execution Regulation Engine
///
/// Runs all five gates to verify artifact safety
pub struct EreEngine;

impl EreEngine {
    pub fn new() -> Self {
        Self
    }

    /// Run all five ERE gates
    ///
    /// # Arguments
    /// * `artifact_id` - Unique identifier for the artifact
    /// * `artifact` - Code to inspect
    /// * `intent` - Declared purpose of the code
    ///
    /// # Returns
    /// Ok(EreReceipt) if all gates pass, Err(ProofFailed) otherwise
    pub fn run_all(
        &self,
        artifact_id: &str,
        artifact: &str,
        intent: &str,
    ) -> Result<EreReceipt> {
        // Run all gates in sequence
        let (p1, p1_findings) = p1_secrets::check_secrets(artifact);
        let (p2, p2_findings) = p2_eval::check_eval(artifact);
        let (p3, p3_findings) = p3_loops::check_loops(artifact);
        let (p4, p4_findings) = p4_telemetry::check_telemetry(artifact);

        // Log findings if any gate failed
        if !p1 || !p2 || !p3 || !p4 {
            let mut all_findings = Vec::new();
            if !p1 { all_findings.extend(p1_findings.iter().cloned()); }
            if !p2 { all_findings.extend(p2_findings.iter().cloned()); }
            if !p3 { all_findings.extend(p3_findings.iter().cloned()); }
            if !p4 { all_findings.extend(p4_findings.iter().cloned()); }

            eprintln!("ERE gates failed:");
            for finding in all_findings {
                eprintln!("  - {}", finding);
            }
        }

        // Compute P5 receipt (fails if any gate failed)
        p5_hash::compute_p5(artifact_id, artifact, intent, p1, p2, p3, p4)
    }

    /// Run gates individually and return detailed results
    pub fn run_detailed(
        &self,
        artifact: &str,
    ) -> (GateResult, GateResult, GateResult, GateResult) {
        (
            p1_secrets::check_secrets(artifact),
            p2_eval::check_eval(artifact),
            p3_loops::check_loops(artifact),
            p4_telemetry::check_telemetry(artifact),
        )
    }
}

impl Default for EreEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ere_engine_clean_artifact() {
        let engine = EreEngine::new();
        let artifact = "function add(a, b) { return a + b; }";
        let result = engine.run_all("test_id", artifact, "pure_function");
        assert!(result.is_ok());

        let receipt = result.unwrap();
        assert!(receipt.verify());
        assert_eq!(receipt.artifact_id, "test_id");
    }

    #[test]
    fn test_ere_engine_with_secret() {
        let engine = EreEngine::new();
        let artifact = "const api_key = 'sk-1234567890';";
        let result = engine.run_all("test_id", artifact, "fetch_data");
        assert!(matches!(result, Err(hyperkitty_core::Error::ProofFailed)));
    }

    #[test]
    fn test_ere_engine_with_eval() {
        let engine = EreEngine::new();
        let artifact = "eval(userInput);";
        let result = engine.run_all("test_id", artifact, "user_defined");
        assert!(matches!(result, Err(hyperkitty_core::Error::ProofFailed)));
    }

    #[test]
    fn test_ere_engine_with_infinite_loop() {
        let engine = EreEngine::new();
        let artifact = "while(true) { console.log('loop'); }";
        let result = engine.run_all("test_id", artifact, "infinite");
        assert!(matches!(result, Err(hyperkitty_core::Error::ProofFailed)));
    }

    #[test]
    fn test_ere_engine_with_telemetry() {
        let engine = EreEngine::new();
        let artifact = "navigator.sendBeacon('/track', data);";
        let result = engine.run_all("test_id", artifact, "tracking");
        assert!(matches!(result, Err(hyperkitty_core::Error::ProofFailed)));
    }

    #[test]
    fn test_ere_engine_detailed_checks() {
        let engine = EreEngine::new();
        let artifact = "function safe() { return 42; }";
        let (p1, p2, p3, p4) = engine.run_detailed(artifact);

        assert!(p1.0, "P1 (secrets) should pass");
        assert!(p2.0, "P2 (eval) should pass");
        assert!(p3.0, "P3 (loops) should pass");
        assert!(p4.0, "P4 (telemetry) should pass");

        assert!(p1.1.is_empty());
        assert!(p2.1.is_empty());
        assert!(p3.1.is_empty());
        assert!(p4.1.is_empty());
    }

    #[test]
    fn test_ere_receipt_properties() {
        let engine = EreEngine::new();
        let artifact = "const x = 1;";
        let receipt = engine.run_all("my_artifact", artifact, "simple").unwrap();

        assert_eq!(receipt.artifact_id, "my_artifact");
        assert!(receipt.p1_pass);
        assert!(receipt.p2_pass);
        assert!(receipt.p3_pass);
        assert!(receipt.p4_pass);
        assert!(receipt.verify());
    }
}
