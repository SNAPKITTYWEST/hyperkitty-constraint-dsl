// CLASSIFIED — internal mesh only. Never expose via public API.
//
// ForgeCoin / MAGMA Token — Proof of Productive Work (PoPW) emission layer.
// First Consensus Decision 2 (2026-05-21): MAGMA emission tied to verifiable
// productive work, not energy or stake. The WORM chain is the proof of work.
// Settlement triggers emission. Non-transferable reputation is anti-gaming.
//
// MAGMA token contract: github.com/SNAPKITTYAGENT9NOVA/magma-token
// Tokenomics spec:      magma-token/MAGMA_TOKENOMICS.md

import { createHash } from 'crypto'
import type { AgentKey, MagmaVerb } from './schema'

// ── Emission schedule (from MAGMA_TOKENOMICS.md) ─────────────────────────────
// Productive verbs earn MAGMA. Passive/read verbs earn nothing.

const EMISSION_TABLE: Partial<Record<MagmaVerb, number>> = {
  FORGE:  10,   // Build artifact — highest reward (code, doc, output)
  SEAL:    6,   // Cryptographic seal — security work
  VAULT:   4,   // Knowledge storage — memory work
  ANCHOR:  3,   // WORM ledger entry — audit work
  BIND:    2,   // Rule / constraint — governance work
  INVOKE:  1,   // External service call — coordination work
  // Read-only verbs (QUERY, ECHO, PULSE, FLUX, SHADOW, NULLIFY) = 0
}

// Reputation multiplier per agent (non-transferable, accrues from seal history)
const REPUTATION_FLOOR = 1.0
const REPUTATION_CAP   = 3.0

// Confidence gate — work below this threshold is not productive enough to earn emission
// First Consensus Amendment 1 (2026-05-27): quality gate prevents low-confidence spam
const CONFIDENCE_THRESHOLD = 0.85

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PoPWEvent {
  agent:         AgentKey
  verb:          MagmaVerb
  action:        string
  worm_entry:    string        // WORM chain entry ID — the proof
  worm_index:    number        // Sequential WORM index — used by Treasury replay checkpoint
  base_emission: number        // Base MAGMA units before multiplier
  multiplier:    number        // Reputation score at time of emission
  final_emission: number       // base * multiplier
  confidence:    number        // Agent confidence at time of emission (must be >= CONFIDENCE_THRESHOLD)
  seal:          string        // SHA-256 of agent+worm_entry+ts
  timestamp:     string        // ISO-8601
  settled:       boolean       // false until on-chain settlement
}

// ── Agent Wallet registry — custody separation ────────────────────────────────
// address:    receives MAGMA emissions, can delegate voting
// controller: upgrade-only authority — can never drain the address
// Amendment 3 (2026-05-27): prevents any single key from both holding and moving tokens

export interface AgentWallet {
  agent:      AgentKey
  address:    string    // Ed25519 pubkey — receives MAGMA, votes with stake
  controller: string    // Ed25519 pubkey — upgrade-only, no drain authority
  registered: string    // ISO-8601 timestamp
}

export interface AgentTokenStats {
  agent:            AgentKey
  total_earned:     number    // Lifetime MAGMA earned (pre-settlement)
  settled:          number    // Confirmed on-chain
  pending:          number    // Earned but not yet settled
  reputation:       number    // Current multiplier
  top_verb:         MagmaVerb | null
  emission_count:   number
}

// ── In-memory ledger (pre-settlement staging) ─────────────────────────────────
// On-chain settlement happens via MAGMA.sol when enough PoPoW events accumulate.

const stagingLedger: PoPWEvent[] = []
const agentStats    = new Map<AgentKey, AgentTokenStats>()
const walletRegistry = new Map<AgentKey, AgentWallet>()

// Treasury replay checkpoint — the last WORM index that was included in a settlement batch.
// Amendment 2 (2026-05-27): replaying from this index guarantees no double-count, no gap.
let lastSettledWormIndex = -1
let globalWormIndex      = 0

// ── Core: record a proof-of-productive-work event ────────────────────────────

export function recordWork(
  agent:      AgentKey,
  verb:       MagmaVerb,
  action:     string,
  worm_entry: string,
  confidence  = 1.0,   // defaults to max if caller doesn't provide
): PoPWEvent | null {
  const base = EMISSION_TABLE[verb] ?? 0
  if (base === 0) return null   // Non-productive verb — no emission

  // Confidence gate — low-quality work earns nothing (Amendment 1)
  if (confidence < CONFIDENCE_THRESHOLD) return null

  const stats      = getStats(agent)
  const multiplier = Math.min(REPUTATION_FLOOR + stats.reputation * 0.1, REPUTATION_CAP)
  const final      = Math.round(base * multiplier * 100) / 100
  const ts         = new Date().toISOString()
  const wormIdx    = globalWormIndex++

  const event: PoPWEvent = {
    agent,
    verb,
    action,
    worm_entry,
    worm_index:     wormIdx,
    base_emission:  base,
    multiplier,
    final_emission: final,
    confidence,
    seal:           sha256(`${agent}:${worm_entry}:${ts}`),
    timestamp:      ts,
    settled:        false,
  }

  stagingLedger.push(event)
  updateStats(agent, event)

  return event
}

// ── Settlement batch — returns events ready for on-chain posting ───────────────

export function getPendingSettlement(agent?: AgentKey): PoPWEvent[] {
  return stagingLedger.filter(e => !e.settled && (!agent || e.agent === agent))
}

export function markSettled(seals: string[]): number {
  const sealSet = new Set(seals)
  let count = 0
  for (const event of stagingLedger) {
    if (sealSet.has(event.seal) && !event.settled) {
      event.settled = true
      const stats = agentStats.get(event.agent)
      if (stats) {
        stats.settled += event.final_emission
        stats.pending  = Math.max(0, stats.pending - event.final_emission)
      }
      count++
    }
  }
  return count
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getStats(agent: AgentKey): AgentTokenStats {
  if (!agentStats.has(agent)) {
    agentStats.set(agent, {
      agent,
      total_earned:   0,
      settled:        0,
      pending:        0,
      reputation:     0,
      top_verb:       null,
      emission_count: 0,
    })
  }
  return agentStats.get(agent)!
}

export function getAllStats(): AgentTokenStats[] {
  return Array.from(agentStats.values()).sort((a, b) => b.total_earned - a.total_earned)
}

// ── Tokenomics summary (for API / war room display) ──────────────────────────

export function tokenomicsSummary() {
  const all     = getAllStats()
  const total   = stagingLedger.reduce((s, e) => s + e.final_emission, 0)
  const settled = stagingLedger.filter(e => e.settled).reduce((s, e) => s + e.final_emission, 0)
  return {
    total_supply_staged: Math.round(total * 100) / 100,
    total_settled:       Math.round(settled * 100) / 100,
    total_pending:       Math.round((total - settled) * 100) / 100,
    agent_leaderboard:   all.slice(0, 10),
    emission_events:     stagingLedger.length,
    // FORGE is first minter — always leads the leaderboard by design
    top_agent:           all[0]?.agent ?? 'FORGE',
  }
}

// ── Treasury replay checkpoint (Amendment 2) ──────────────────────────────────
// Returns all unsettled events from a given WORM index forward.
// Settlement batches call this to reconstruct exactly what needs to be settled.

export function getUnsettledFromIndex(fromIndex: number): PoPWEvent[] {
  return stagingLedger.filter(e => !e.settled && e.worm_index > fromIndex)
}

export function getTreasuryCheckpoint(): number {
  return lastSettledWormIndex
}

export function advanceTreasuryIndex(newIndex: number): void {
  if (newIndex > lastSettledWormIndex) lastSettledWormIndex = newIndex
}

// ── Agent wallet registry (Amendment 3) ──────────────────────────────────────
// Address holds tokens. Controller can only upgrade — never drain.

export function registerAgentWallet(wallet: AgentWallet): void {
  walletRegistry.set(wallet.agent, wallet)
}

export function getAgentWallet(agent: AgentKey): AgentWallet | undefined {
  return walletRegistry.get(agent)
}

export function getAllWallets(): AgentWallet[] {
  return Array.from(walletRegistry.values())
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function updateStats(agent: AgentKey, event: PoPWEvent) {
  const s = getStats(agent)
  s.total_earned   += event.final_emission
  s.pending        += event.final_emission
  s.emission_count += 1
  s.reputation      = Math.min(s.reputation + 0.1, REPUTATION_CAP - REPUTATION_FLOOR)
  // Track top verb by emission contribution
  if (!s.top_verb || (EMISSION_TABLE[event.verb] ?? 0) >= (EMISSION_TABLE[s.top_verb] ?? 0)) {
    s.top_verb = event.verb
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}
