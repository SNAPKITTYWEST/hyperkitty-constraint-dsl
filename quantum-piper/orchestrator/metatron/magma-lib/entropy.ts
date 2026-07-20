// CLASSIFIED — Sovereign Entropy Engine
// No external RNG is trusted. All randomness is derived from the system's own state:
//   hardware noise (crypto.randomBytes) + monotonic timestamp + WORM chain hash + agent hashes.
//
// Pool: 512-byte ring buffer refreshed every 60s or on explicit stir.
// drawEntropy(seed) — mixes seed into the pool and returns a 32-byte hex token.
// External RNG (Math.random) is never used in sovereign infrastructure.
//
// §BIND:SENTINEL:ENTROPY{sovereign:true, external_rng:false, pool_bytes:512}
import crypto from 'crypto'

// ── Pool ──────────────────────────────────────────────────────────────────────
let _pool:         Buffer = crypto.randomBytes(512)
let _poolCursor:   number = 0
let _lastRefresh:  number = Date.now()
const REFRESH_MS   = 60_000   // 60s auto-refresh
const POOL_BYTES   = 512

function refreshPool(): void {
  // Mix in new hardware noise, timestamp, and existing pool state
  const noise   = crypto.randomBytes(64)
  const ts      = Buffer.allocUnsafe(8)
  ts.writeBigUInt64BE(BigInt(Date.now()))

  const mixer = crypto.createHash('sha512')
    .update(_pool)
    .update(noise)
    .update(ts)
    .digest()

  // XOR mixer back into pool at current cursor position
  for (let i = 0; i < mixer.length; i++) {
    _pool[(_poolCursor + i) % POOL_BYTES] ^= mixer[i]
  }
  _poolCursor   = (_poolCursor + mixer.length) % POOL_BYTES
  _lastRefresh  = Date.now()
}

// ── Stir with sovereign material ─────────────────────────────────────────────
// Call after every WORM commit, SLC verdict, or mesh execution to keep the pool
// fed with system-state entropy.
export function stirPool(material: string): void {
  const hash = crypto.createHash('sha256').update(material).digest()
  for (let i = 0; i < hash.length; i++) {
    _pool[(_poolCursor + i) % POOL_BYTES] ^= hash[i]
  }
  _poolCursor = (_poolCursor + hash.length) % POOL_BYTES
}

// ── Draw ──────────────────────────────────────────────────────────────────────
// Mixes caller-supplied seed into the pool and returns 32 hex bytes.
// Async because heavy callers (mutation engine) may pass WORM hashes as seeds.
export async function drawEntropy(seed?: string): Promise<string> {
  if (Date.now() - _lastRefresh > REFRESH_MS) refreshPool()

  // Mix seed into pool
  if (seed) stirPool(seed)

  // Extract 32 bytes starting at cursor, advance
  const out = Buffer.allocUnsafe(32)
  for (let i = 0; i < 32; i++) {
    out[i] = _pool[(_poolCursor + i) % POOL_BYTES]
  }
  _poolCursor = (_poolCursor + 32) % POOL_BYTES

  // Final hash so the output is uniformly distributed
  return crypto.createHash('sha256')
    .update(out)
    .update(Buffer.from(String(Date.now())))
    .digest('hex')
}

// ── Deterministic seeded draw ─────────────────────────────────────────────────
// Same seed → same output. Used for honeypot fake-transaction determinism.
// Does NOT consume pool entropy — purely deterministic.
export function deterministicDraw(seed: string): string {
  return crypto.createHash('sha256').update(`sovereign:${seed}`).digest('hex')
}

// ── Pool health ───────────────────────────────────────────────────────────────
export function entropyStatus(): {
  pool_bytes:    number
  cursor:        number
  last_refresh:  number
  age_ms:        number
} {
  return {
    pool_bytes:   POOL_BYTES,
    cursor:       _poolCursor,
    last_refresh: _lastRefresh,
    age_ms:       Date.now() - _lastRefresh,
  }
}
