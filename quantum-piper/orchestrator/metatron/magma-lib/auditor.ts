// CLASSIFIED — Auditor Query Interface
// Clearance-gated inspection of mesh state, SLC verdicts, mutation log,
// filesystem ACL violations, entropy status, and queue depth.
// Only CIPHER, SENTINEL, PHANTOM (clearance 5) or ORACLE, NEXUS (clearance 4) may query.
//
// Auditor never writes — read-only by construction.
// ~HIDDEN ops visible only to clearance 5.
//
// §BIND:SENTINEL:AUDITOR{read_only:true, clearance_gated:true, hidden_visible:5}
import { getSchema }           from './schema'
import type { AgentKey }       from './schema'
import { queueDepth, peek }    from './queue'
import { recentMutations }     from './mutation-engine'
import { recentExecutions }    from './mesh'
import { recentViolations, violationCount } from './fs-acl'
import { entropyStatus }       from './entropy'
import { recentStale, registrySize } from './chunk-registry'

export type AuditQueryType =
  | 'mutations'          // mutation-engine records
  | 'mesh_executions'    // mesh poll results
  | 'fs_violations'      // filesystem ACL denials
  | 'queue_state'        // current queue lane depths + preview
  | 'chunk_registry'     // stale chunk log + registry size
  | 'entropy'            // entropy pool status
  | 'full_snapshot'      // all of the above

export interface AuditQuery {
  type:    AuditQueryType
  agent:   AgentKey          // must be clearance 4+
  limit?:  number            // max records per collection
  since?:  number            // unix ms — filter by timestamp
}

export interface AuditReport {
  queried_by:     AgentKey
  clearance:      number
  type:           AuditQueryType
  ts:             number
  data:           Record<string, unknown>
}

const MIN_CLEARANCE = 4
const HIDDEN_CLEARANCE = 5

export async function audit(q: AuditQuery): Promise<AuditReport | null> {
  const schema = getSchema(q.agent)
  if (!schema || schema.clearance < MIN_CLEARANCE) {
    return null  // silently refuse — no error leakage
  }

  const canSeeHidden = schema.clearance >= HIDDEN_CLEARANCE
  const limit        = q.limit ?? 50

  let data: Record<string, unknown> = {}

  switch (q.type) {

    case 'mutations': {
      let records = recentMutations(limit)
      if (q.since) records = records.filter(r => r.ts >= q.since!)
      data = { mutations: records, count: records.length }
      break
    }

    case 'mesh_executions': {
      let execs = recentExecutions(limit)
      if (!canSeeHidden) {
        // Strip ~HIDDEN op results from non-clearance-5 auditors
        execs = execs.filter(e => e.posture !== 'pass' || e.executed)
      }
      if (q.since) execs = execs.filter(e => e.ts >= q.since!)
      data = { executions: execs, count: execs.length }
      break
    }

    case 'fs_violations': {
      let viols = recentViolations(limit)
      if (q.since) viols = viols.filter(v => v.ts >= q.since!)
      data = {
        violations:       viols,
        count:            viols.length,
        total_violations: violationCount(),
      }
      break
    }

    case 'queue_state': {
      const [depth, lanes] = await Promise.all([queueDepth(), peek(Math.min(limit, 20))])
      data = { depth, lanes }
      break
    }

    case 'chunk_registry': {
      const [stale, size] = await Promise.all([recentStale(limit), registrySize()])
      data = { stale, registry_size: size }
      break
    }

    case 'entropy': {
      // Only clearance 5 sees entropy internals — entropy state is sensitive
      if (!canSeeHidden) {
        data = { redacted: true, reason: 'clearance_5_required' }
      } else {
        data = entropyStatus()
      }
      break
    }

    case 'full_snapshot': {
      const [depth, lanes, stale, size] = await Promise.all([
        queueDepth(),
        peek(10),
        recentStale(20),
        registrySize(),
      ])

      data = {
        mutations:    recentMutations(20),
        executions:   recentExecutions(20),
        fs_violations: recentViolations(20),
        violation_total: violationCount(),
        queue:        { depth, lanes },
        chunk_registry: { stale, registry_size: size },
        entropy:      canSeeHidden ? entropyStatus() : { redacted: true },
      }
      break
    }
  }

  return {
    queried_by: q.agent,
    clearance:  schema.clearance,
    type:       q.type,
    ts:         Date.now(),
    data,
  }
}

// ── Startup integrity check ───────────────────────────────────────────────────
// Call once on server start. Verifies all 28 member tokens are derivable.
// Logs to console — non-fatal, but a failure here means VAULT_MASTER_SECRET mismatch.
export function startupRosterAudit(): void {
  // Lazy import to avoid circular dependency at module load time
  import('./verify-membership').then(({ auditRoster, DOORS_CLOSED, DOORS_SEALED_AT }) => {
    const { valid, invalid, errors } = auditRoster()
    if (invalid > 0) {
      console.error(`[GUILD] Roster audit failed: ${invalid} invalid tokens. Errors:`, errors)
    } else {
      console.log(`[GUILD] Roster audit passed: ${valid}/${valid + invalid} members verified. Doors: ${DOORS_CLOSED ? `CLOSED (${DOORS_SEALED_AT})` : 'OPEN'}`)
    }
  }).catch(() => {})
}

// ── API handler (mount at /api/magma/audit) ───────────────────────────────────
// POST { type, agent, limit?, since? }  →  AuditReport | 403
// This route must be auth-gated — only accessible in authenticated sessions.
export async function handleAuditRequest(
  body: unknown
): Promise<{ status: number; json: unknown }> {
  if (
    typeof body !== 'object' || body === null ||
    !('type' in body) || !('agent' in body)
  ) {
    return { status: 400, json: { error: 'missing_fields' } }
  }

  const q = body as AuditQuery
  const report = await audit(q)

  if (!report) {
    return { status: 403, json: { error: 'clearance_insufficient' } }
  }

  return { status: 200, json: report }
}
