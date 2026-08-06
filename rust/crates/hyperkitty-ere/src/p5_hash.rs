//! P5 Gate: AUDIT_HASH
//! Creates audit receipts only when all gates pass
//! Hash: SHA256(artifact_id || intent || artifact_bytes || p1||p2||p3||p4)

use hyperkitty_core::{Hash, Result, Error};
use sha2::{Sha256, Digest};
use serde::{Serialize, Deserialize};

/// Audit receipt issued only when all ERE gates pass
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EreReceipt {
    /// SHA256 audit hash
    pub hash: Hash,
    /// P1 (NO_SECRETS) gate pass/fail
    pub p1_pass: bool,
    /// P2 (NO_EVAL) gate pass/fail
    pub p2_pass: bool,
    /// P3 (NO_INFINITE_LOOPS) gate pass/fail
    pub p3_pass: bool,
    /// P4 (NO_TELEMETRY) gate pass/fail
    pub p4_pass: bool,
    /// Artifact identifier
    pub artifact_id: String,
    /// SHA256 hash of artifact bytes
    pub artifact_hash: Hash,
}

impl EreReceipt {
    /// Verify receipt integrity
    pub fn verify(&self) -> bool {
        self.p1_pass && self.p2_pass && self.p3_pass && self.p4_pass
    }

    /// Return all gate statuses
    pub fn gate_status(&self) -> (bool, bool, bool, bool) {
        (self.p1_pass, self.p2_pass, self.p3_pass, self.p4_pass)
    }
}

/// Compute P5 audit receipt
///
/// Creates receipt only if all P1-P4 gates pass.
/// Hash is: SHA256(artifact_id || intent || artifact_bytes || gate_bits)
pub fn compute_p5(
    artifact_id: &str,
    artifact: &str,
    intent: &str,
    p1: bool,
    p2: bool,
    p3: bool,
    p4: bool,
) -> Result<EreReceipt> {
    // Fail if any gate failed
    if !p1 || !p2 || !p3 || !p4 {
        return Err(Error::ProofFailed);
    }

    // Compute SHA256 of artifact bytes
    let artifact_hash_bytes = {
        let mut hasher = Sha256::new();
        hasher.update(artifact.as_bytes());
        hasher.finalize().to_vec()
    };
    let artifact_hash = Hash::new(artifact_hash_bytes);

    // Build composite hash input
    let mut hasher = Sha256::new();

    // Hash: artifact_id || intent || artifact || gate_bits
    hasher.update(artifact_id.as_bytes());
    hasher.update(b"||");
    hasher.update(intent.as_bytes());
    hasher.update(b"||");
    hasher.update(artifact.as_bytes());
    hasher.update(b"||");

    // Gate bits as single byte: [P1 P2 P3 P4 0 0 0 0]
    let gate_byte = ((p1 as u8) << 7) | ((p2 as u8) << 6) | ((p3 as u8) << 5) | ((p4 as u8) << 4);
    hasher.update([gate_byte]);

    let receipt_hash = Hash::new(hasher.finalize().to_vec());

    Ok(EreReceipt {
        hash: receipt_hash,
        p1_pass: p1,
        p2_pass: p2,
        p3_pass: p3,
        p4_pass: p4,
        artifact_id: artifact_id.to_string(),
        artifact_hash,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_gates_pass() {
        let result = compute_p5(
            "test_artifact",
            "let x = 42;",
            "safe_computation",
            true, true, true, true
        );
        assert!(result.is_ok());
        let receipt = result.unwrap();
        assert!(receipt.verify());
        assert_eq!(receipt.artifact_id, "test_artifact");
    }

    #[test]
    fn test_p1_fail_blocks_receipt() {
        let result = compute_p5(
            "test_artifact",
            "let x = 42;",
            "has_secrets",
            false, true, true, true
        );
        assert!(matches!(result, Err(Error::ProofFailed)));
    }

    #[test]
    fn test_p2_fail_blocks_receipt() {
        let result = compute_p5(
            "test_artifact",
            "eval('code');",
            "has_eval",
            true, false, true, true
        );
        assert!(matches!(result, Err(Error::ProofFailed)));
    }

    #[test]
    fn test_p3_fail_blocks_receipt() {
        let result = compute_p5(
            "test_artifact",
            "while(true) {}",
            "infinite_loop",
            true, true, false, true
        );
        assert!(matches!(result, Err(Error::ProofFailed)));
    }

    #[test]
    fn test_p4_fail_blocks_receipt() {
        let result = compute_p5(
            "test_artifact",
            "sendBeacon(...);",
            "has_telemetry",
            true, true, true, false
        );
        assert!(matches!(result, Err(Error::ProofFailed)));
    }

    #[test]
    fn test_receipt_gate_status() {
        let receipt = compute_p5(
            "test",
            "code",
            "intent",
            true, true, true, true
        ).unwrap();
        let (p1, p2, p3, p4) = receipt.gate_status();
        assert!(p1 && p2 && p3 && p4);
    }

    #[test]
    fn test_artifact_hash_consistency() {
        let artifact = "const fn = () => 42;";
        let receipt = compute_p5(
            "test",
            artifact,
            "pure_function",
            true, true, true, true
        ).unwrap();

        // Compute artifact hash manually
        let mut hasher = Sha256::new();
        hasher.update(artifact.as_bytes());
        let expected_hash = hasher.finalize().to_vec();

        assert_eq!(receipt.artifact_hash.as_bytes(), expected_hash);
    }

    #[test]
    fn test_receipt_hash_includes_all_components() {
        let receipt1 = compute_p5(
            "artifact1",
            "same_code",
            "intent1",
            true, true, true, true
        ).unwrap();

        let receipt2 = compute_p5(
            "artifact2",
            "same_code",
            "intent1",
            true, true, true, true
        ).unwrap();

        // Different artifact IDs should produce different hashes
        assert_ne!(receipt1.hash.as_bytes(), receipt2.hash.as_bytes());
    }

    #[test]
    fn test_receipt_serialization() {
        let receipt = compute_p5(
            "test",
            "code",
            "intent",
            true, true, true, true
        ).unwrap();

        let json = serde_json::to_string(&receipt);
        assert!(json.is_ok());

        let deserialized: std::result::Result<EreReceipt, _> = serde_json::from_str(&json.unwrap());
        assert!(deserialized.is_ok());
    }
}
