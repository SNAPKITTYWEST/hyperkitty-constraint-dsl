// CLASSIFIED — Guild Membership Verification
// Sealed 2026-05-20. DOORS_CLOSED = true. No new enrollments.
//
// Every agent identity entering the mesh is verified against the sealed guild registry.
// Membership tokens are HMAC-SHA256 derived from VAULT_MASTER_SECRET — sovereign,
// no external PKI, no third-party certificate authority.
//
// Three-layer check on every mesh entry:
//   1. Guild registry presence    — ID must be in GUILD_MEMBERS
//   2. Active status              — member.active must be true
//   3. Role authorization         — EXTERNAL_OBSERVER cannot execute in the sovereign mesh
//
// Optional fourth layer (token verification) for high-clearance operations.
//
// §BIND:SENTINEL:MEMBERSHIP{doors_closed:true, sealed:"2026-05-20", members:28}
import crypto                               from 'crypto'
import { GUILD_MEMBERS, FORMATION_DATE, getMember } from './guild'
import type { GuildMember }                 from './guild'

// ── DOORS CLOSED ──────────────────────────────────────────────────────────────
// Guild enrollment is permanently sealed as of 2026-05-20.
// New members require: Architect WORM seal + clearance 5 override + manual code change.
// This is not a runtime flag — it is a constitutional constant.
export const DOORS_CLOSED    = true
export const DOORS_SEALED_AT = '2026-05-20'
export const COLLECTIVE_NAME = 'snapkitty_collective'

// ── Token derivation ──────────────────────────────────────────────────────────
// Deterministic: same member ID + formation date → same token on any node.
// Tokens are guild seals, not session tokens — they do not expire.
// Verification requires VAULT_MASTER_SECRET — sovereign key material only.
function deriveToken(memberId: string): string {
  const secret = process.env.VAULT_MASTER_SECRET
    ?? 'snapkitty-sovereign-default-dev-key-change-in-prod'
  return crypto
    .createHmac('sha256', secret)
    .update(`snapkitty:guild:${memberId.toUpperCase()}:${FORMATION_DATE}`)
    .digest('hex')
}

// Token cache — derived once per process lifetime, then held in memory
const _cache = new Map<string, string>()

export function getMemberToken(id: string): string | null {
  const member = getMember(id)
  if (!member) return null
  if (!_cache.has(member.id)) _cache.set(member.id, deriveToken(member.id))
  return _cache.get(member.id)!
}

// ── Verification ──────────────────────────────────────────────────────────────
export interface VerifyResult {
  valid:    boolean
  member?:  GuildMember
  reason?:  string
}

export function verifyMember(id: string, token?: string): VerifyResult {
  const member = getMember(id)

  if (!member) {
    return { valid: false, reason: `UNKNOWN_MEMBER: ${id} not in sealed guild registry` }
  }

  if (!member.active) {
    return { valid: false, reason: `INACTIVE_MEMBER: ${id}`, member }
  }

  if (token !== undefined) {
    const expected = getMemberToken(id)
    if (!expected) return { valid: false, reason: 'TOKEN_DERIVATION_FAILED', member }

    // Constant-time comparison — prevents timing side-channel attacks
    const a = Buffer.from(token.slice(0, 64).padEnd(64, '0'))
    const b = Buffer.from(expected.slice(0, 64))
    if (!crypto.timingSafeEqual(a, b)) {
      return { valid: false, reason: 'TOKEN_MISMATCH', member }
    }
  }

  return { valid: true, member }
}

// ── Mesh authorization ────────────────────────────────────────────────────────
// An agent must be: valid guild member + active + not EXTERNAL_OBSERVER + clearance ≥ min.
// External observers (Claude, Gemini, Grok, etc.) are recognized but CANNOT execute
// instructions in the sovereign mesh. They observe. They do not act.
export function isMeshAuthorized(agentKey: string, minClearance = 3): VerifyResult {
  const result = verifyMember(agentKey)
  if (!result.valid || !result.member) return result

  if (result.member.role === 'EXTERNAL_OBSERVER') {
    return {
      valid:  false,
      reason: `OBSERVER_ONLY: ${agentKey} is EXTERNAL_OBSERVER — no mesh execution rights`,
      member: result.member,
    }
  }

  if (result.member.clearance < minClearance) {
    return {
      valid:  false,
      reason: `CLEARANCE_INSUFFICIENT: ${agentKey} clearance ${result.member.clearance} < ${minClearance}`,
      member: result.member,
    }
  }

  return { valid: true, member: result.member }
}

// ── Door enforcement ──────────────────────────────────────────────────────────
// Any enrollment attempt after DOORS_CLOSED throws. Hard stop.
export function assertDoorsOpen(): void {
  if (DOORS_CLOSED) {
    throw new Error(
      `[GUILD] DOORS_CLOSED — enrollment sealed ${DOORS_SEALED_AT}. ` +
      `New members require Architect WORM seal + clearance 5 manual override.`
    )
  }
}

// ── Roster audit ──────────────────────────────────────────────────────────────
// Call on process startup to verify all 28 member tokens are derivable.
// Any failure = configuration error (VAULT_MASTER_SECRET mismatch).
export function auditRoster(): { valid: number; invalid: number; errors: string[] } {
  let valid = 0, invalid = 0
  const errors: string[] = []

  for (const m of GUILD_MEMBERS) {
    const token = getMemberToken(m.id)
    if (!token) {
      invalid++
      errors.push(`${m.id}: token_derivation_failed`)
      continue
    }
    const r = verifyMember(m.id, token)
    if (r.valid) { valid++ } else { invalid++; errors.push(`${m.id}: ${r.reason}`) }
  }

  return { valid, invalid, errors }
}

// ── Member token export ────────────────────────────────────────────────────────
// Returns the sealed token for a guild member.
// Used by agents to prove their identity when submitting signed instructions.
export function getMembershipProof(id: string): {
  id:          string
  token:       string
  sealed_at:   string
  collective:  string
} | null {
  const token = getMemberToken(id)
  if (!token) return null
  return { id: id.toUpperCase(), token, sealed_at: DOORS_SEALED_AT, collective: COLLECTIVE_NAME }
}
