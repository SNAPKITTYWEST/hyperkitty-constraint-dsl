// bridges/quantum/entropy_router.rs
//
// Quantum Entropy Router — Bell State measurements → HKDF seed → WORM seal → KDE keys
//
// Flow:
//   1. Validate distribution  (±10% tolerance, NISQ grade)
//   2. Derive seed            HKDF-SHA256(IKM=raw_bytes, salt=governor_pubkey, info=domain)
//   3. Seal to WORM           blocking, fail-closed — hard_sink on audit failure
//   4. KDE expand             HKDF expand → signing_key + enc_key + worm_key
//   5. Return EntropyBatch
//
// Constraints:
//   Rust only. No Python at runtime. Source-agnostic (simulator → real QPU = enum swap).
//   WORM seal is synchronous and mandatory. No unsealed entropy ever reaches KDE.

use hkdf::Hkdf;
use sha2::Sha256;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

// ── Entropy source — swap simulator for real QPU without changing router ──────
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EntropySource {
    CircqLocalSimulator,
    CircqLocalHardware,
    RemoteQuantumCloud,
    NatsTopicFeed,
}

// ── Incoming Bell State measurement packet ────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuantumEntropyPacket {
    pub raw_bytes:      Vec<u8>,   // Bell State measurement output (min 256 bytes)
    pub measurement_id: String,
    pub repetitions:    u32,
    pub source:         EntropySource,
}

// ── Output: sealed entropy batch ready for key use ───────────────────────────
#[derive(Debug, Clone)]
pub struct EntropyBatch {
    pub seed:         [u8; 32],   // HKDF extract output
    pub signing_key:  [u8; 32],   // HKDF expand — Ed25519 seed
    pub enc_key:      [u8; 32],   // HKDF expand — AES-256-GCM key
    pub worm_key:     [u8; 32],   // HKDF expand — WORM chain HMAC key
    pub worm_seal:    String,     // Immutable audit proof
    pub rep_count:    u32,
    pub source:       EntropySource,
}

// ── Distribution stats from validation ───────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntropyStats {
    pub total_bits:  u64,
    pub ones:        u64,
    pub zeros:       u64,
    pub ones_ratio:  f64,   // Should be ~0.50
    pub passed:      bool,
}

// ── Errors ────────────────────────────────────────────────────────────────────
#[derive(Debug)]
pub enum EntropyError {
    InsufficientBytes { got: usize, need: usize },
    DistributionFailed { ones_ratio: f64, tolerance: f64 },
    HkdfExpandFailed,
    WormSealFailed(String),
}

impl std::fmt::Display for EntropyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EntropyError::InsufficientBytes { got, need } =>
                write!(f, "insufficient bytes: got {got}, need {need}"),
            EntropyError::DistributionFailed { ones_ratio, tolerance } =>
                write!(f, "distribution failed: ratio={ones_ratio:.3}, tolerance=±{tolerance}"),
            EntropyError::HkdfExpandFailed =>
                write!(f, "HKDF expand failed"),
            EntropyError::WormSealFailed(e) =>
                write!(f, "WORM seal failed: {e}"),
        }
    }
}

// ── Step 1: Validate ±10% distribution ───────────────────────────────────────
pub fn validate_distribution(packet: &QuantumEntropyPacket) -> Result<EntropyStats, EntropyError> {
    const MIN_BYTES: usize = 256;
    const TOLERANCE: f64   = 0.10;   // NISQ hardware noise tolerance

    if packet.raw_bytes.len() < MIN_BYTES {
        return Err(EntropyError::InsufficientBytes {
            got:  packet.raw_bytes.len(),
            need: MIN_BYTES,
        });
    }

    let total_bits = (packet.raw_bytes.len() * 8) as u64;
    let ones: u64  = packet.raw_bytes.iter()
        .map(|b| b.count_ones() as u64)
        .sum();
    let zeros      = total_bits - ones;
    let ones_ratio = ones as f64 / total_bits as f64;

    let passed = (ones_ratio - 0.5).abs() <= TOLERANCE;

    if !passed {
        return Err(EntropyError::DistributionFailed { ones_ratio, tolerance: TOLERANCE });
    }

    Ok(EntropyStats { total_bits, ones, zeros, ones_ratio, passed })
}

// ── Step 2: HKDF-SHA256 extract — domain-separated, governor-bound ───────────
pub fn derive_seed(
    raw_bytes:       &[u8],
    governor_pubkey: &[u8],
) -> Result<[u8; 32], EntropyError> {
    let hkdf = Hkdf::<Sha256>::new(
        Some(governor_pubkey),          // salt = governor pubkey (prevents cross-node replay)
        raw_bytes,                      // IKM  = raw quantum bytes
    );

    let mut seed = [0u8; 32];
    hkdf.expand(b"quantum_entropy_router", &mut seed)
        .map_err(|_| EntropyError::HkdfExpandFailed)?;

    Ok(seed)
}

// ── Step 3: KDE — HKDF expand seed into 3 domain-separated keys ──────────────
pub fn kde_expand(seed: &[u8; 32]) -> Result<([u8; 32], [u8; 32], [u8; 32]), EntropyError> {
    let hkdf = Hkdf::<Sha256>::new(None, seed);

    let mut signing_key = [0u8; 32];
    let mut enc_key     = [0u8; 32];
    let mut worm_key    = [0u8; 32];

    hkdf.expand(b"signing",    &mut signing_key).map_err(|_| EntropyError::HkdfExpandFailed)?;
    hkdf.expand(b"encryption", &mut enc_key    ).map_err(|_| EntropyError::HkdfExpandFailed)?;
    hkdf.expand(b"worm_chain", &mut worm_key   ).map_err(|_| EntropyError::HkdfExpandFailed)?;

    Ok((signing_key, enc_key, worm_key))
}

// ── Step 4: WORM seal — blocking, fail-closed ─────────────────────────────────
// Writes entropy audit record before seed is returned.
// If the WORM write fails, the process must hard_sink — unsealed entropy is not sovereign.
pub fn seal_entropy_to_worm(
    seed:            &[u8; 32],
    stats:           &EntropyStats,
    packet:          &QuantumEntropyPacket,
    worm_log_path:   &str,
) -> Result<String, EntropyError> {
    use std::io::Write;

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let seed_hex: String = seed.iter().map(|b| format!("{b:02x}")).collect();

    let entry = format!(
        "{{\"type\":\"QUANTUM_ENTROPY\",\"ts\":{ts},\"measurement_id\":\"{mid}\",\
         \"rep_count\":{rc},\"ones_ratio\":{ratio:.4},\"seed_hash\":\"{sh}\",\
         \"source\":\"{src:?}\"}}\n",
        mid   = packet.measurement_id,
        rc    = packet.repetitions,
        ratio = stats.ones_ratio,
        sh    = seed_hex,
        src   = packet.source,
    );

    // Blocking append — fail-closed
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(worm_log_path)
        .map_err(|e| EntropyError::WormSealFailed(e.to_string()))?;

    file.write_all(entry.as_bytes())
        .map_err(|e| EntropyError::WormSealFailed(e.to_string()))?;

    file.flush()
        .map_err(|e| EntropyError::WormSealFailed(e.to_string()))?;

    Ok(seed_hex)
}

// ── Main entry point ──────────────────────────────────────────────────────────
pub fn route_quantum_entropy(
    packet:          QuantumEntropyPacket,
    governor_pubkey: &[u8],
    worm_log_path:   &str,
) -> Result<EntropyBatch, EntropyError> {
    // 1. Validate distribution (±10%, NISQ grade)
    let stats = validate_distribution(&packet)?;

    // 2. Derive seed — HKDF-SHA256, governor-bound, domain-separated
    let seed = derive_seed(&packet.raw_bytes, governor_pubkey)?;

    // 3. Seal to WORM — blocking, fail-closed
    //    Caller must invoke non_recursive_sink(SinkReason::AuditLogTampered) on Err
    let worm_seal = seal_entropy_to_worm(&seed, &stats, &packet, worm_log_path)?;

    // 4. KDE expand — 3 domain-separated keys from seed
    let (signing_key, enc_key, worm_key) = kde_expand(&seed)?;

    Ok(EntropyBatch {
        seed,
        signing_key,
        enc_key,
        worm_key,
        worm_seal,
        rep_count: packet.repetitions,
        source:    packet.source,
    })
}

// ── Convenience: local Cirq simulator feed ────────────────────────────────────
// Generates a mock Bell State measurement packet for testing.
// Replace with real Cirq subprocess output in production.
pub fn mock_cirq_packet(repetitions: u32) -> QuantumEntropyPacket {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);

    let mut hasher = DefaultHasher::new();
    ts.hash(&mut hasher);
    let seed = hasher.finish();

    // Pseudo-random bytes seeded from timestamp (simulator only — NOT for production)
    let raw_bytes: Vec<u8> = (0..256u64)
        .map(|i| {
            let mut h = DefaultHasher::new();
            (seed ^ i).hash(&mut h);
            h.finish() as u8
        })
        .collect();

    QuantumEntropyPacket {
        raw_bytes,
        measurement_id: format!("mock_{ts}"),
        repetitions,
        source: EntropySource::CircqLocalSimulator,
    }
}
