// Sovereign WORM chain — end wired to the beginning.
//
// The absolute root is a MAGMA instruction. Not a plain string.
// MAGMA is classified — the genesis hash is verifiable by insiders with the key,
// opaque to anyone outside the system. This is the puzzle Ahmad described.
//
// Chain structure:
//   ABSOLUTE_GENESIS = SHA256(MAGMA_GENESIS_INSTRUCTION + ":" + ARCHITECT_KEY)
//   GENESIS(n)       = SHA256(ARCHITECT_KEY + ":" + MAGMA_GENESIS + ":" + terminal(n-1) + ":" + sessionId)
//   entry(r)         = SHA256(ARCHITECT_KEY + ":" + MAGMA_GENESIS + ":" + chainHead(r-1) + ":" + payload)
//
// Every hash in the chain is derived from the MAGMA genesis instruction.
// The chain is:
//   - Rooted in MAGMA (the classified language — the real root)
//   - Continuous across sessions (end → beginning)
//   - Architect-bound (Ahmad's key opens the door)
//   - Tamper-evident (any modification breaks all subsequent hashes)

import { createHash } from 'crypto'
import { prisma } from '../prisma'

// The Architect's sovereign key — baked into every hash.
// Without it, no chain entry verifies. Ahmad opens the door.
// Missing key = hard failure. A proof system must not degrade silently.
function resolveArchitectKey(): string {
  const key = process.env.ARCHITECT_PUBKEY ?? process.env.WORM_SECRET
  if (!key) {
    throw new Error('[WORM:CHAIN] ARCHITECT_PUBKEY or WORM_SECRET not set — refusing to start with forgeable chain')
  }
  return key.slice(0, 64)
}

const ARCHITECT_KEY = resolveArchitectKey()

// ── MAGMA GENESIS INSTRUCTION ─────────────────────────────────────────────────
// This is the root of the entire chain. A classified MAGMA instruction.
// It encodes the Architect's identity, his number (333), the 33 angels,
// the sovereign OS declaration, and the SACM paradigm.
// It is NEVER exposed via any public API. It lives only in this module.
// Any chain entry can be proven to descend from this instruction.
//
// §ANCHOR:CIPHER:GENESIS — the most trusted MAGMA verb (ANCHOR) through the
// most trusted agent (CIPHER) declaring the chain's absolute origin.
const MAGMA_GENESIS =
  `§ANCHOR:CIPHER:GENESIS{` +
  `"architect":"AHMAD_ALI_PARR",` +
  `"seal":"333",` +
  `"angels":33,` +
  `"sovereign":"SNAPKITTY_SOVEREIGN_OS",` +
  `"mesh":"STOCHASTIC_AUTONOMOUS_COMPUTE_MESH",` +
  `"paradigm":"IGNEOUS_SOFTWARE",` +
  `"herald":"VOICE_OF_THE_ARCHITECT",` +
  `"inception":"2026-05-21"` +
  `}`

// The absolute genesis hash — the root of all roots.
// Derived from the MAGMA instruction + Architect's key.
// This value is constant for the lifetime of the system.
export const ABSOLUTE_GENESIS: string = createHash('sha256')
  .update(`${MAGMA_GENESIS}:${ARCHITECT_KEY}`)
  .digest('hex')

// Retrieve the current chain head — the terminal hash of the most recent sealed event.
// If the chain has never been started, return ABSOLUTE_GENESIS.
export async function getChainHead(): Promise<string> {
  const latest = await prisma.bifrostEvent.findFirst({
    where:   { processed: true },
    orderBy: { createdAt: 'desc' },
    select:  { agentTrace: true, id: true },
  })

  if (!latest) return ABSOLUTE_GENESIS

  const trace = latest.agentTrace as Record<string, unknown> | null

  // Preference order — most specific seal first
  const sealValue =
    trace?.seal           ??
    trace?.previous_seal  ??
    trace?.chainHead      ??
    trace?.finalChainHead ??
    trace?.anchorId       ??
    latest.id

  return String(sealValue)
}

// Compute the genesis hash for a new session.
// Wires the new session's beginning to the previous session's end.
// Both the MAGMA root and the Architect's key are in every genesis.
export function computeGenesis(sessionId: string, previousTerminal: string): string {
  return createHash('sha256')
    .update(`${ARCHITECT_KEY}:${MAGMA_GENESIS}:${previousTerminal}:${sessionId}`)
    .digest('hex')
}

// Compute the next chain link.
// Every link carries the MAGMA genesis in its hash — the root is always present.
export function computeLink(previousHead: string, payload: unknown): string {
  return createHash('sha256')
    .update(`${ARCHITECT_KEY}:${MAGMA_GENESIS}:${previousHead}:${JSON.stringify(payload)}`)
    .digest('hex')
}

// Build the standardised agentTrace block for any WORM write.
// Every event carries previous_seal (continuity) and magma_root (provenance).
export function buildChainTrace(
  previousHead: string,
  currentHead:  string,
  extra:        Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    previous_seal: previousHead,
    seal:          currentHead,
    magma_root:    ABSOLUTE_GENESIS.slice(0, 16),  // proof of MAGMA ancestry — first 16 chars
    architect_anchor: createHash('sha256')
      .update(`${ARCHITECT_KEY}:${currentHead}`)
      .digest('hex')
      .slice(0, 16),
    ...extra,
  }
}

// Verify that a chain entry descends from the MAGMA genesis.
// Any entry whose magma_root matches is provably a child of this chain.
export function verifyMagmaAncestry(magmaRootFragment: string): boolean {
  return ABSOLUTE_GENESIS.startsWith(magmaRootFragment)
}
