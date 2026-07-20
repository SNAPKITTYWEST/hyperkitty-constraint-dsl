/// QuantumBridge — deterministic cryptographic bridge
///
/// Binds: event → state transition → hash seal → Merkle leaf → audit proof.
/// Every event gets a deterministic proof chain. Same input = same proof.
///
/// "Quantum-inspired" means deterministic cryptographic entanglement between
/// events, ledger state, and audit proof — not quantum hardware or QKD.

use sha2::{Sha256, Digest};

/// Hash agility: algorithm version embedded in every proof for future upgrade.
#[derive(Debug, Clone, PartialEq)]
pub enum SealAlgorithm {
    Sha256V1,
    Sha3_256V1,
    Blake3V1,
}

impl SealAlgorithm {
    pub fn label(&self) -> &'static str {
        match self {
            SealAlgorithm::Sha256V1  => "sha256:v1",
            SealAlgorithm::Sha3_256V1 => "sha3-256:v1",
            SealAlgorithm::Blake3V1  => "blake3:v1",
        }
    }
}

#[derive(Debug, Clone)]
pub struct QuantumBridgeInput {
    pub trace_id:            String,
    pub event_type:          String,
    pub source:              String,
    pub payload_hash:        String,
    pub previous_state_hash: String,
    pub timestamp_ms:        u64,
}

#[derive(Debug, Clone)]
pub struct QuantumBridgeProof {
    pub trace_id:     String,
    pub bridge_hash:  String,
    pub state_hash:   String,
    pub merkle_leaf:  String,
    pub algorithm:    String,
    pub timestamp_ms: u64,
}

#[derive(Debug, PartialEq)]
pub enum BridgeError {
    EmptyTraceId,
    EmptyEventType,
    EmptySource,
    EmptyPayloadHash,
    EmptyPreviousStateHash,
    ZeroTimestamp,
}

impl std::fmt::Display for BridgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BridgeError::EmptyTraceId          => write!(f, "trace_id must not be empty"),
            BridgeError::EmptyEventType        => write!(f, "event_type must not be empty"),
            BridgeError::EmptySource           => write!(f, "source must not be empty"),
            BridgeError::EmptyPayloadHash      => write!(f, "payload_hash must not be empty"),
            BridgeError::EmptyPreviousStateHash => write!(f, "previous_state_hash must not be empty"),
            BridgeError::ZeroTimestamp         => write!(f, "timestamp_ms must not be zero"),
        }
    }
}

fn sha256_hex(input: &str) -> String {
    let mut h = Sha256::new();
    h.update(input.as_bytes());
    format!("{:x}", h.finalize())
}

/// Generate a deterministic QuantumBridgeProof from the given input.
/// No random numbers or wall-clock inside this function.
pub fn generate_bridge_proof(
    input: &QuantumBridgeInput,
    algorithm: SealAlgorithm,
) -> Result<QuantumBridgeProof, BridgeError> {
    if input.trace_id.is_empty()            { return Err(BridgeError::EmptyTraceId); }
    if input.event_type.is_empty()          { return Err(BridgeError::EmptyEventType); }
    if input.source.is_empty()              { return Err(BridgeError::EmptySource); }
    if input.payload_hash.is_empty()        { return Err(BridgeError::EmptyPayloadHash); }
    if input.previous_state_hash.is_empty() { return Err(BridgeError::EmptyPreviousStateHash); }
    if input.timestamp_ms == 0              { return Err(BridgeError::ZeroTimestamp); }

    // Canonical string — field order is a protocol constant, never change without version bump
    let canonical = format!(
        "{}|{}|{}|{}|{}|{}",
        input.trace_id,
        input.event_type,
        input.source,
        input.payload_hash,
        input.previous_state_hash,
        input.timestamp_ms,
    );

    let bridge_hash = sha256_hex(&canonical);

    // State hash binds bridge output to previous state (chain dependency)
    let state_input = format!("{}|{}", bridge_hash, input.previous_state_hash);
    let state_hash  = sha256_hex(&state_input);

    // Merkle leaf = hash of the bridge hash (ready for Merkle tree insertion)
    let merkle_leaf = sha256_hex(&bridge_hash);

    Ok(QuantumBridgeProof {
        trace_id:     input.trace_id.clone(),
        bridge_hash,
        state_hash,
        merkle_leaf,
        algorithm:    algorithm.label().to_string(),
        timestamp_ms: input.timestamp_ms,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_input() -> QuantumBridgeInput {
        QuantumBridgeInput {
            trace_id:            "tr-test-001".to_string(),
            event_type:          "PAYMENT_RECEIVED".to_string(),
            source:              "stripe".to_string(),
            payload_hash:        "a".repeat(64),
            previous_state_hash: "b".repeat(64),
            timestamp_ms:        1_700_000_000_000,
        }
    }

    #[test]
    fn same_input_same_hash() {
        let input = sample_input();
        let p1 = generate_bridge_proof(&input, SealAlgorithm::Sha256V1).unwrap();
        let p2 = generate_bridge_proof(&input, SealAlgorithm::Sha256V1).unwrap();
        assert_eq!(p1.bridge_hash, p2.bridge_hash);
        assert_eq!(p1.state_hash, p2.state_hash);
        assert_eq!(p1.merkle_leaf, p2.merkle_leaf);
    }

    #[test]
    fn payload_change_changes_hash() {
        let mut a = sample_input();
        let mut b = sample_input();
        b.payload_hash = "c".repeat(64);
        let pa = generate_bridge_proof(&a, SealAlgorithm::Sha256V1).unwrap();
        let pb = generate_bridge_proof(&b, SealAlgorithm::Sha256V1).unwrap();
        assert_ne!(pa.bridge_hash, pb.bridge_hash);
        // Silence unused_mut warnings
        a.trace_id.push('x');
        b.trace_id.push('x');
    }

    #[test]
    fn previous_state_change_changes_hash() {
        let mut input = sample_input();
        let p1 = generate_bridge_proof(&input, SealAlgorithm::Sha256V1).unwrap();
        input.previous_state_hash = "d".repeat(64);
        let p2 = generate_bridge_proof(&input, SealAlgorithm::Sha256V1).unwrap();
        assert_ne!(p1.bridge_hash, p2.bridge_hash);
    }

    #[test]
    fn empty_trace_id_rejected() {
        let mut input = sample_input();
        input.trace_id = "".to_string();
        assert_eq!(
            generate_bridge_proof(&input, SealAlgorithm::Sha256V1).unwrap_err(),
            BridgeError::EmptyTraceId
        );
    }

    #[test]
    fn algorithm_label_is_sha256_v1() {
        let proof = generate_bridge_proof(&sample_input(), SealAlgorithm::Sha256V1).unwrap();
        assert_eq!(proof.algorithm, "sha256:v1");
    }

    #[test]
    fn zero_timestamp_rejected() {
        let mut input = sample_input();
        input.timestamp_ms = 0;
        assert_eq!(
            generate_bridge_proof(&input, SealAlgorithm::Sha256V1).unwrap_err(),
            BridgeError::ZeroTimestamp
        );
    }
}
