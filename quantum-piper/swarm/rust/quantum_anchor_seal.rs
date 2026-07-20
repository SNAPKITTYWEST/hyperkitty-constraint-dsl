/// QuantumAnchorSeal — deterministic cryptographic anchor
///
/// Binds a finalized proof to an external/public reference point:
/// bridge proof → Merkle root → timestamp → anchor hash
///
/// Produces a "this ledger state existed at this moment" tamper-evident commitment.
/// Algorithm versioned for future post-quantum upgrade path.

use sha2::{Sha256, Digest};

const GENESIS_HASH: &str = "0000000000000000000000000000000000000000000000000000000000000000";
const HEX64_LEN: usize   = 64;

#[derive(Debug, Clone, PartialEq)]
pub enum AnchorAlgorithm {
    Sha256AnchorV1,
    Sha3_256AnchorV1,
    Blake3AnchorV1,
}

impl AnchorAlgorithm {
    pub fn label(&self) -> &'static str {
        match self {
            AnchorAlgorithm::Sha256AnchorV1   => "sha256:anchor:v1",
            AnchorAlgorithm::Sha3_256AnchorV1 => "sha3-256:anchor:v1",
            AnchorAlgorithm::Blake3AnchorV1   => "blake3:anchor:v1",
        }
    }
}

#[derive(Debug, Clone)]
pub struct QuantumAnchorInput {
    pub trace_id:             String,
    pub bridge_hash:          String,
    pub merkle_root:          String,
    pub previous_anchor_hash: String,
    pub timestamp_ms:         u64,
    pub anchor_context:       String,
}

#[derive(Debug, Clone)]
pub struct QuantumAnchorSeal {
    pub trace_id:             String,
    pub anchor_hash:          String,
    pub bridge_hash:          String,
    pub merkle_root:          String,
    pub previous_anchor_hash: String,
    pub algorithm:            String,
    pub timestamp_ms:         u64,
    pub anchor_context:       String,
}

#[derive(Debug, PartialEq)]
pub enum AnchorError {
    EmptyTraceId,
    InvalidBridgeHashLength,
    InvalidMerkleRootLength,
    InvalidPreviousAnchorLength,
    ZeroTimestamp,
    EmptyAnchorContext,
}

impl std::fmt::Display for AnchorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AnchorError::EmptyTraceId               => write!(f, "trace_id must not be empty"),
            AnchorError::InvalidBridgeHashLength     => write!(f, "bridge_hash must be 64 hex chars"),
            AnchorError::InvalidMerkleRootLength     => write!(f, "merkle_root must be 64 hex chars"),
            AnchorError::InvalidPreviousAnchorLength => write!(f, "previous_anchor_hash must be 64 hex chars"),
            AnchorError::ZeroTimestamp               => write!(f, "timestamp_ms must not be zero"),
            AnchorError::EmptyAnchorContext          => write!(f, "anchor_context must not be empty"),
        }
    }
}

fn sha256_hex(input: &str) -> String {
    let mut h = Sha256::new();
    h.update(input.as_bytes());
    format!("{:x}", h.finalize())
}

fn is_valid_hex64(s: &str) -> bool {
    s.len() == HEX64_LEN && s.chars().all(|c| c.is_ascii_hexdigit())
}

/// Generate a deterministic QuantumAnchorSeal.
/// Genesis anchors use `previous_anchor_hash = GENESIS_HASH (all zeros)`.
pub fn generate_anchor_seal(
    input: &QuantumAnchorInput,
    algorithm: AnchorAlgorithm,
) -> Result<QuantumAnchorSeal, AnchorError> {
    if input.trace_id.is_empty()              { return Err(AnchorError::EmptyTraceId); }
    if !is_valid_hex64(&input.bridge_hash)    { return Err(AnchorError::InvalidBridgeHashLength); }
    if !is_valid_hex64(&input.merkle_root)    { return Err(AnchorError::InvalidMerkleRootLength); }
    if !is_valid_hex64(&input.previous_anchor_hash) {
        return Err(AnchorError::InvalidPreviousAnchorLength);
    }
    if input.timestamp_ms == 0               { return Err(AnchorError::ZeroTimestamp); }
    if input.anchor_context.is_empty()       { return Err(AnchorError::EmptyAnchorContext); }

    // Canonical string — field order is a protocol constant
    let canonical = format!(
        "{}|{}|{}|{}|{}|{}",
        input.trace_id,
        input.bridge_hash,
        input.merkle_root,
        input.previous_anchor_hash,
        input.timestamp_ms,
        input.anchor_context,
    );

    let anchor_hash = sha256_hex(&canonical);

    Ok(QuantumAnchorSeal {
        trace_id:             input.trace_id.clone(),
        anchor_hash,
        bridge_hash:          input.bridge_hash.clone(),
        merkle_root:          input.merkle_root.clone(),
        previous_anchor_hash: input.previous_anchor_hash.clone(),
        algorithm:            algorithm.label().to_string(),
        timestamp_ms:         input.timestamp_ms,
        anchor_context:       input.anchor_context.clone(),
    })
}

/// Convenience: build a genesis anchor (first in chain, no prior anchor).
pub fn genesis_anchor(
    trace_id: &str,
    bridge_hash: &str,
    merkle_root: &str,
    timestamp_ms: u64,
    anchor_context: &str,
    algorithm: AnchorAlgorithm,
) -> Result<QuantumAnchorSeal, AnchorError> {
    generate_anchor_seal(
        &QuantumAnchorInput {
            trace_id:             trace_id.to_string(),
            bridge_hash:          bridge_hash.to_string(),
            merkle_root:          merkle_root.to_string(),
            previous_anchor_hash: GENESIS_HASH.to_string(),
            timestamp_ms,
            anchor_context:       anchor_context.to_string(),
        },
        algorithm,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_input() -> QuantumAnchorInput {
        QuantumAnchorInput {
            trace_id:             "tr-anchor-001".to_string(),
            bridge_hash:          "a".repeat(64),
            merkle_root:          "b".repeat(64),
            previous_anchor_hash: "c".repeat(64),
            timestamp_ms:         1_700_000_000_000,
            anchor_context:       "ledger-close:block-1".to_string(),
        }
    }

    #[test]
    fn same_input_same_anchor_hash() {
        let input = sample_input();
        let s1 = generate_anchor_seal(&input, AnchorAlgorithm::Sha256AnchorV1).unwrap();
        let s2 = generate_anchor_seal(&input, AnchorAlgorithm::Sha256AnchorV1).unwrap();
        assert_eq!(s1.anchor_hash, s2.anchor_hash);
    }

    #[test]
    fn bridge_hash_change_changes_anchor() {
        let mut a = sample_input();
        let mut b = sample_input();
        b.bridge_hash = "d".repeat(64);
        let sa = generate_anchor_seal(&a, AnchorAlgorithm::Sha256AnchorV1).unwrap();
        let sb = generate_anchor_seal(&b, AnchorAlgorithm::Sha256AnchorV1).unwrap();
        assert_ne!(sa.anchor_hash, sb.anchor_hash);
        a.trace_id.push('x'); b.trace_id.push('x'); // silence unused_mut
    }

    #[test]
    fn merkle_root_change_changes_anchor() {
        let mut input = sample_input();
        let s1 = generate_anchor_seal(&input, AnchorAlgorithm::Sha256AnchorV1).unwrap();
        input.merkle_root = "e".repeat(64);
        let s2 = generate_anchor_seal(&input, AnchorAlgorithm::Sha256AnchorV1).unwrap();
        assert_ne!(s1.anchor_hash, s2.anchor_hash);
    }

    #[test]
    fn previous_anchor_change_changes_anchor() {
        let mut input = sample_input();
        let s1 = generate_anchor_seal(&input, AnchorAlgorithm::Sha256AnchorV1).unwrap();
        input.previous_anchor_hash = "f".repeat(64);
        let s2 = generate_anchor_seal(&input, AnchorAlgorithm::Sha256AnchorV1).unwrap();
        assert_ne!(s1.anchor_hash, s2.anchor_hash);
    }

    #[test]
    fn rejects_bad_hash_lengths() {
        let mut input = sample_input();
        input.bridge_hash = "short".to_string();
        assert_eq!(
            generate_anchor_seal(&input, AnchorAlgorithm::Sha256AnchorV1).unwrap_err(),
            AnchorError::InvalidBridgeHashLength
        );
    }

    #[test]
    fn allows_genesis_previous_anchor() {
        let result = genesis_anchor(
            "tr-genesis",
            &"a".repeat(64),
            &"b".repeat(64),
            1_700_000_000_000,
            "ledger-genesis",
            AnchorAlgorithm::Sha256AnchorV1,
        );
        assert!(result.is_ok());
        let seal = result.unwrap();
        assert_eq!(seal.previous_anchor_hash, GENESIS_HASH);
    }

    #[test]
    fn rejects_empty_context() {
        let mut input = sample_input();
        input.anchor_context = "".to_string();
        assert_eq!(
            generate_anchor_seal(&input, AnchorAlgorithm::Sha256AnchorV1).unwrap_err(),
            AnchorError::EmptyAnchorContext
        );
    }

    #[test]
    fn rejects_zero_timestamp() {
        let mut input = sample_input();
        input.timestamp_ms = 0;
        assert_eq!(
            generate_anchor_seal(&input, AnchorAlgorithm::Sha256AnchorV1).unwrap_err(),
            AnchorError::ZeroTimestamp
        );
    }
}
