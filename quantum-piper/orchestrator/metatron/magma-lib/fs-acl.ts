// CLASSIFIED — Filesystem-Level ACL
// Every file path read or written by an agent passes through this layer.
// ACL is derived from agent clearance + explicit path grants.
// Violations are rejected and logged; they do not reach the filesystem.
//
// Path notation: prefix/** grants recursive access, prefix/file.ts grants exact file.
// DENY entries override ALLOW entries (explicit deny wins).
//
// §BIND:SENTINEL:FS_ACL{deny_wins:true, clearance_gated:true}
import path from 'path'
import { getSchema } from './schema'
import type { AgentKey } from './schema'

export type FsOp = 'read' | 'write' | 'delete'

export interface AclViolation {
  agent:    AgentKey
  op:       FsOp
  filePath: string
  reason:   string
  ts:       number
}

const _violations: AclViolation[] = []

// ── Path grants by clearance level ───────────────────────────────────────────
// Clearance N → may access any path NOT in a higher-clearance-only zone.
// Lower numbers = less access.
const CLEARANCE_ALLOW: Record<number, string[]> = {
  1: ['public/**', 'pages/academy/**', 'pages/api/language/**'],
  2: ['public/**', 'pages/**', 'components/**', 'styles/**'],
  3: ['**'],            // clearance 3+ gets broad read
  4: ['**'],
  5: ['**'],
}

// These paths require explicit clearance 5 even for writes
const SOVEREIGN_PATHS = [
  'lib/magma/**',
  'lib/crypto-vault.ts',
  'snapkitty-core/**',
  'prisma/schema.prisma',
  '.env*',
  'CLAUDE.md',
  'AGENTS.md',
]

// Agents explicitly denied from writing config/secrets regardless of clearance
const WRITE_DENY_PATTERNS: string[] = [
  '.env*',
  '**/*.key',
  '**/*.pem',
  '**/secrets/**',
]

// ── Glob match ────────────────────────────────────────────────────────────────
// Simple glob: ** = any path segments, * = any filename chars, no regex.
function globMatch(pattern: string, filePath: string): boolean {
  const p = pattern.replace(/\*\*/g, '\x00').replace(/\*/g, '[^/]*').replace(/\x00/g, '.*')
  return new RegExp(`^${p}$`).test(filePath)
}

function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/').replace(/^\//, '')
}

// ── ACL check ─────────────────────────────────────────────────────────────────
export interface AclResult {
  allowed:  boolean
  reason:   string
}

export function checkAccess(agent: AgentKey, op: FsOp, filePath: string): AclResult {
  const schema    = getSchema(agent)
  const clearance = schema?.clearance ?? 1
  const norm      = normalizePath(filePath)

  // Explicit write-deny patterns apply to everyone (including clearance 5)
  if (op === 'write' || op === 'delete') {
    for (const pattern of WRITE_DENY_PATTERNS) {
      if (globMatch(pattern, norm)) {
        const reason = `WRITE_DENY: ${pattern} matches ${norm}`
        _violations.push({ agent, op, filePath: norm, reason, ts: Date.now() })
        return { allowed: false, reason }
      }
    }
  }

  // Sovereign paths require clearance 5
  for (const pattern of SOVEREIGN_PATHS) {
    if (globMatch(pattern, norm)) {
      if (clearance < 5) {
        const reason = `SOVEREIGN_PATH: clearance ${clearance} < 5 for ${norm}`
        _violations.push({ agent, op, filePath: norm, reason, ts: Date.now() })
        return { allowed: false, reason }
      }
    }
  }

  // Clearance-gated path grants
  const allowPatterns = CLEARANCE_ALLOW[Math.min(clearance, 5)] ?? []
  for (const pattern of allowPatterns) {
    if (globMatch(pattern, norm)) {
      return { allowed: true, reason: `clearance:${clearance} pattern:${pattern}` }
    }
  }

  const reason = `NO_GRANT: clearance ${clearance} has no grant for ${norm}`
  _violations.push({ agent, op, filePath: norm, reason, ts: Date.now() })
  return { allowed: false, reason }
}

// ── Enforced wrapper ──────────────────────────────────────────────────────────
// Wrap any file operation — throws if ACL denied.
export function enforce(agent: AgentKey, op: FsOp, filePath: string): void {
  const result = checkAccess(agent, op, filePath)
  if (!result.allowed) {
    throw new Error(`[FS-ACL] ${agent} ${op.toUpperCase()} DENIED: ${result.reason}`)
  }
}

// ── Grant override ────────────────────────────────────────────────────────────
// Clearance-5 agents (CIPHER/SENTINEL) can register temporary grants (TTL in ms).
const _tempGrants: Array<{ agent: AgentKey; pattern: string; until: number }> = []

export function grantTemporary(
  grantedBy: AgentKey,
  target:    AgentKey,
  pattern:   string,
  ttlMs:     number,
): boolean {
  const grantor = getSchema(grantedBy)
  if (!grantor || grantor.clearance < 5) return false

  _tempGrants.push({ agent: target, pattern, until: Date.now() + ttlMs })
  return true
}

// Check temp grants (called from checkAccess extension — not wired above for brevity)
export function hasTempGrant(agent: AgentKey, filePath: string): boolean {
  const norm = normalizePath(filePath)
  const now  = Date.now()
  return _tempGrants.some(
    g => g.agent === agent && g.until > now && globMatch(g.pattern, norm)
  )
}

// ── Audit ─────────────────────────────────────────────────────────────────────
export function recentViolations(n = 50): AclViolation[] {
  return _violations.slice(-n)
}

export function violationCount(): number {
  return _violations.length
}
