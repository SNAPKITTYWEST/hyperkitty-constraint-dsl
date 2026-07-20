// CLASSIFIED — Mutation Engine
// Intercepts Magma instructions before execution.
// Every mutation is tracked and Ed25519-signed to maintain chain of custody.
// Entropy-seeded to ensure non-deterministic mutation IDs resistant to replay.
//
// Transforms applied in order:
//   1. DECAY check      — expire TTL instructions (null = drop)
//   2. SLC sanitize     — redact adversarial patterns in string payload values
//   3. Payload enrich   — QUERY/FORGE/ANCHOR get mesh context metadata injected
//   4. Chain inject     — splice prior __chain output into payload
//   5. Rehash + sign    — recompute hash, Ed25519-sign mutation record
//
// §BIND:SENTINEL:MUTATION_ENGINE{sign_all:true, decay:true, enrich:true, entropy:true}
import crypto                      from 'crypto'
import { signDecision }            from '../crypto-vault'
import { sanitize, evaluate }      from './slc'
import { drawEntropy }             from './entropy'
import type { MagmaInstruction, MagmaModifier } from './schema'

export interface MutationRecord {
  original_hash:  string
  mutated_hash:   string
  entropy_seed:   string           // sovereign entropy mixed into this mutation
  transforms:     string[]
  sig:            string           // Ed25519 hex of mutated_hash
  agent:          string
  ts:             number
}

// Ring buffer — last 500 mutation records
const _log: MutationRecord[] = []

export function recentMutations(n = 20): MutationRecord[] {
  return _log.slice(-n)
}

// ── Decay check ───────────────────────────────────────────────────────────────
// ~DECAY(n) instructions expire n seconds after creation timestamp.
function decayCheck(instr: MagmaInstruction): boolean {
  const mod = instr.modifiers.find(m => m.startsWith('~DECAY('))
  if (!mod) return true
  const ttl = parseInt(mod.slice(7, -1), 10)
  return (Date.now() - instr.timestamp) / 1000 < ttl
}

function stripDecay(modifiers: MagmaModifier[]): MagmaModifier[] {
  return modifiers.filter(m => !m.startsWith('~DECAY('))
}

// ── Payload sanitization ──────────────────────────────────────────────────────
function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    out[k] = typeof v === 'string' ? sanitize(v) : v
  }
  return out
}

// ── Payload enrichment ────────────────────────────────────────────────────────
const ENRICH_VERBS = new Set(['QUERY', 'FORGE', 'ANCHOR', 'VAULT'])

function enrich(instr: MagmaInstruction, entropySeed: string): Record<string, unknown> {
  if (!ENRICH_VERBS.has(instr.verb)) return instr.payload
  return {
    ...instr.payload,
    _mesh_agent:    instr.agent,
    _mesh_verb:     instr.verb,
    _mesh_enrich:   Date.now(),
    _mesh_entropy:  entropySeed.slice(0, 8),
  }
}

// ── Rehash ────────────────────────────────────────────────────────────────────
function rehash(instr: MagmaInstruction): string {
  const raw = `${instr.verb}:${instr.agent}:${instr.action}:${JSON.stringify(instr.payload)}:${instr.timestamp}`
  return crypto.createHash('sha256').update(raw).digest('hex')
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function mutate(instr: MagmaInstruction): Promise<MagmaInstruction | null> {
  const originalHash  = instr.hash ?? rehash(instr)
  const transforms: string[] = []

  // 1. Decay
  if (!decayCheck(instr)) return null
  const modifiers = stripDecay(instr.modifiers as MagmaModifier[])
  if (modifiers.length !== instr.modifiers.length) transforms.push('DECAY_CONSUMED')

  // 2. SLC sanitize — clean adversarial strings in payload values
  const slcVerdict = evaluate(JSON.stringify(instr.payload))
  let payload = instr.payload
  if (slcVerdict.posture !== 'pass') {
    payload = sanitizePayload(instr.payload)
    transforms.push('SANITIZE')
  }

  // 3. Entropy draw — sovereign randomness mixed into this mutation
  const entropySeed = await drawEntropy(originalHash)

  // 4. Enrich
  const enriched = enrich({ ...instr, payload }, entropySeed)
  if (enriched !== payload) transforms.push('ENRICH')

  // 5. Rebuild
  const mutated: MagmaInstruction = {
    ...instr,
    payload:   enriched,
    modifiers,
    hash:      '',
  }

  const mutatedHash = rehash(mutated)
  mutated.hash      = mutatedHash

  // 6. Ed25519 sign — chain of custody
  const signed = signDecision({
    agent:      instr.agent,
    reply:      mutatedHash,
    seal:       originalHash,
    approved:   true,
    confidence: 1,
  })

  const record: MutationRecord = {
    original_hash: originalHash,
    mutated_hash:  mutatedHash,
    entropy_seed:  entropySeed,
    transforms,
    sig:           signed.sig,
    agent:         instr.agent,
    ts:            Date.now(),
  }

  _log.push(record)
  if (_log.length > 500) _log.shift()

  return mutated
}
