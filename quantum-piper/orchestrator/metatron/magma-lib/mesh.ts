// CLASSIFIED — Sovereign Autonomous Compute Mesh (SACM)
// Self-organizing execution layer. No central orchestrator.
// Governance = schema permissions + priority queue + SLC gate + marinating cycle.
//
// Flow per instruction:
//   dequeue → SLC gate (pass 1) → mutation engine → marinate (dwell + SLC pass 2)
//   → dispatch handler → write-back → §ANCHOR broadcast
//
// §BIND:SENTINEL:SOVEREIGN_MESH{self_organizing:true, marinate:true, sign_all:true}
import { dequeue, enqueue, buildInstruction, queueDepth } from './queue'
import { evaluate }                                        from './slc'
import { getSchema, canUseVerb }                          from './schema'
import type { AgentKey, MagmaInstruction }                from './schema'
import { writeBack }                                      from './write-back'
import { mutate }                                         from './mutation-engine'
import { isMeshAuthorized }                               from './verify-membership'

// ── Marinating cycle ──────────────────────────────────────────────────────────
// Dwell time between dequeue and execution. During this window the instruction
// sits in memory and is re-evaluated by the SLC.
// Higher clearance = tighter scrutiny = longer dwell.
// Analogous to magma cooling: the longer it dwells, the more crystalline the result.
const MARINATE_MS: Record<number, number> = {
  5: 2500,   // CIPHER / SENTINEL / MNEMEX / PHANTOM
  4: 1500,   // ORACLE / NEXUS / FORGE / NOVA
  3: 750,    // AXIOM / HERALD / FLUX
  2: 250,
  1: 0,
}

export interface MeshResult {
  instruction_id: string
  agent:          AgentKey
  executed:       boolean
  posture:        string
  worm_id?:       string
  reply?:         string
  marinate_ms:    number
  mutation_sig?:  string
}

// ── Handler registry ─────────────────────────────────────────────────────────
type InstructionHandler = (instr: MagmaInstruction) => Promise<{ reply: string; wormId?: string }>

const _handlers: Partial<Record<string, Partial<Record<string, InstructionHandler>>>> = {}

export function registerHandler(
  agent:   AgentKey,
  action:  string,
  fn:      InstructionHandler,
): void {
  if (!_handlers[agent]) _handlers[agent] = {}
  _handlers[agent]![action] = fn
}

// ── Execution log (ring buffer) ───────────────────────────────────────────────
const _execLog: Array<MeshResult & { ts: number }> = []

function logExec(result: MeshResult): void {
  _execLog.push({ ...result, ts: Date.now() })
  if (_execLog.length > 1000) _execLog.shift()
}

// ── Marinate ──────────────────────────────────────────────────────────────────
async function marinate(
  instr:     MagmaInstruction,
  clearance: number,
): Promise<{ ok: boolean; violation?: string }> {
  const ms = MARINATE_MS[clearance] ?? 0
  if (ms > 0) await new Promise(r => setTimeout(r, ms))

  // SLC pass 2 — re-evaluate after dwell (catches obfuscated adversarial payloads)
  const verdict = evaluate(JSON.stringify(instr.payload), {
    agent:    instr.agent as AgentKey,
    endpoint: 'mesh:marinate',
  })

  if (verdict.posture === 'reject' || verdict.posture === 'quarantine') {
    return { ok: false, violation: verdict.violations[0] }
  }
  return { ok: true }
}

// ── Core: poll + execute ──────────────────────────────────────────────────────
// Call this from a worker loop for a given agent.
// Returns null if the queue is empty or the dequeued instruction belongs to another agent.
export async function poll(agentKey: AgentKey): Promise<MeshResult | null> {
  // ── Membership gate — first check before anything else ───────────────────
  const auth = isMeshAuthorized(agentKey)
  if (!auth.valid) {
    return {
      instruction_id: 'REJECTED_AT_DOOR',
      agent:          agentKey,
      executed:       false,
      posture:        'reject',
      marinate_ms:    0,
    }
  }

  const schema = getSchema(agentKey)
  if (!schema) return null

  const raw = await dequeue()
  if (!raw) return null

  // Instruction not targeted at this agent — re-enqueue and yield
  if (raw.agent !== agentKey) {
    await enqueue(raw)
    return null
  }

  const start = Date.now()

  // ── SLC pass 1: gate raw instruction ─────────────────────────────────────
  const rawVerdict = evaluate(JSON.stringify(raw), {
    agent:    agentKey,
    endpoint: 'mesh:gate',
  })

  if (rawVerdict.posture === 'reject' || rawVerdict.posture === 'quarantine') {
    const r: MeshResult = {
      instruction_id: raw.id,
      agent:          agentKey,
      executed:       false,
      posture:        rawVerdict.posture,
      marinate_ms:    0,
    }
    logExec(r)
    return r
  }

  // ── Mutation engine ───────────────────────────────────────────────────────
  const mutated = await mutate(raw)
  if (!mutated) {
    const r: MeshResult = {
      instruction_id: raw.id,
      agent:          agentKey,
      executed:       false,
      posture:        'quarantine',
      marinate_ms:    0,
    }
    logExec(r)
    return r
  }

  // ── Marinating cycle ──────────────────────────────────────────────────────
  const mar        = await marinate(mutated, schema.clearance)
  const marinate_ms = Date.now() - start

  if (!mar.ok) {
    const r: MeshResult = {
      instruction_id: raw.id,
      agent:          agentKey,
      executed:       false,
      posture:        'quarantine',
      marinate_ms,
    }
    logExec(r)
    return r
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────
  const handler = _handlers[agentKey]?.[mutated.action]
  if (!handler) {
    const r: MeshResult = {
      instruction_id: mutated.id,
      agent:          agentKey,
      executed:       false,
      posture:        rawVerdict.posture,
      marinate_ms,
    }
    logExec(r)
    return r
  }

  try {
    const { reply, wormId } = await handler(mutated)

    // ── Write-back (fire-and-forget) ──────────────────────────────────────
    if (schema.can_write_to.includes('KnowledgeChunk') && reply) {
      writeBack({
        agentKey,
        sessionId:  (mutated.payload.sessionId as string) ?? 'mesh',
        query:      mutated.action,
        reply,
        seal:       mutated.hash ?? '',
        wormId:     wormId ?? mutated.id,
        confidence: (mutated.payload.confidence as number) ?? 1,
        topic:      mutated.payload.topic as string | undefined,
      }).catch(() => {})
    }

    const r: MeshResult = {
      instruction_id: mutated.id,
      agent:          agentKey,
      executed:       true,
      posture:        rawVerdict.posture,
      worm_id:        wormId,
      reply,
      marinate_ms,
      mutation_sig:   mutated.hash,
    }
    logExec(r)
    return r

  } catch {
    const r: MeshResult = {
      instruction_id: mutated.id,
      agent:          agentKey,
      executed:       false,
      posture:        'pass',
      marinate_ms,
    }
    logExec(r)
    return r
  }
}

// ── NEXUS: agent-to-agent invocation ─────────────────────────────────────────
// NEXUS (and any clearance-4+ agent with INVOKE) can dispatch to another agent.
export async function invoke(
  fromAgent:   AgentKey,
  targetAgent: AgentKey,
  action:      string,
  payload:     Record<string, unknown> = {},
): Promise<{ ok: boolean; id: string }> {
  if (!canUseVerb(fromAgent, 'INVOKE')) return { ok: false, id: '' }
  const instr = buildInstruction('INVOKE', targetAgent, action, payload, ['~CHAIN'])
  const res   = await enqueue(instr)
  return { ok: res.ok, id: res.id }
}

// ── Mesh health ───────────────────────────────────────────────────────────────
export async function meshStatus(): Promise<{
  registered_agents: AgentKey[]
  handler_counts:    Partial<Record<AgentKey, number>>
  queue_depth:       Record<string, number>
  recent_executions: number
}> {
  const registered_agents = Object.keys(_handlers) as AgentKey[]
  const handler_counts: Partial<Record<AgentKey, number>> = {}
  for (const a of registered_agents) {
    handler_counts[a] = Object.keys(_handlers[a] ?? {}).length
  }
  return {
    registered_agents,
    handler_counts,
    queue_depth:       await queueDepth(),
    recent_executions: _execLog.length,
  }
}

// Expose execution log for the auditor
export function recentExecutions(n = 50): Array<MeshResult & { ts: number }> {
  return _execLog.slice(-n)
}
