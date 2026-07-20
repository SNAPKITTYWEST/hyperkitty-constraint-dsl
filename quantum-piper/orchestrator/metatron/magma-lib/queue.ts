// CLASSIFIED — Magma priority queue. Redis-backed, 4 priority lanes.
// Lane 0 = ~URGENT  (BRPOP head)
// Lane 1 = ~SIGNED / ~CHAIN
// Lane 2 = default
// Lane 3 = ~ASYNC / background
import crypto from 'crypto'
import { Redis } from '@upstash/redis'
import type { MagmaInstruction, MagmaVerb, AgentKey, MagmaModifier } from './schema'
import { priority, canUseVerb } from './schema'

const LANE = (p: number) => `magma:queue:lane${p}`
const DLQ  = 'magma:queue:dlq'
const MAX_QUEUE = 1000

let redis: Redis | null = null
function getRedis(): Redis {
  if (!redis) redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
  return redis
}

export function buildInstruction(
  verb:      MagmaVerb,
  agent:     AgentKey,
  action:    string,
  payload:   Record<string, unknown> = {},
  modifiers: MagmaModifier[] = [],
): MagmaInstruction {
  const ts   = Date.now()
  const raw  = `${verb}:${agent}:${action}:${JSON.stringify(payload)}:${ts}`
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return { verb, agent, action, payload, modifiers, id: hash.slice(0, 16), timestamp: ts, hash }
}

// Enqueue — validates verb permission, routes to correct priority lane
export async function enqueue(instr: MagmaInstruction): Promise<{ ok: boolean; lane: number; id: string }> {
  if (!canUseVerb(instr.agent, instr.verb)) {
    const dlqEntry = { ...instr, dlq_reason: `${instr.agent} cannot use verb ${instr.verb}` }
    await getRedis().lpush(DLQ, JSON.stringify(dlqEntry))
    return { ok: false, lane: -1, id: instr.id }
  }

  const lane = priority(instr)
  const r    = getRedis()

  // Backpressure: cap each lane at MAX_QUEUE
  const len = await r.llen(LANE(lane))
  if (len >= MAX_QUEUE) {
    await r.lpush(DLQ, JSON.stringify({ ...instr, dlq_reason: 'lane_full' }))
    return { ok: false, lane, id: instr.id }
  }

  await r.lpush(LANE(lane), JSON.stringify(instr))
  return { ok: true, lane, id: instr.id }
}

// Dequeue — strict priority: drain lane 0 before lane 1, etc.
export async function dequeue(): Promise<MagmaInstruction | null> {
  const r = getRedis()
  for (let lane = 0; lane <= 3; lane++) {
    const raw = await r.rpop<string>(LANE(lane))
    if (raw) {
      try { return typeof raw === 'string' ? JSON.parse(raw) : raw }
      catch { continue }
    }
  }
  return null
}

// Peek at next N items across all lanes without consuming
export async function peek(n = 10): Promise<{ lane: number; items: MagmaInstruction[] }[]> {
  const r = getRedis()
  return Promise.all([0, 1, 2, 3].map(async lane => {
    const raws = await r.lrange(LANE(lane), 0, n - 1) as string[]
    const items = raws.flatMap(raw => {
      try { return [typeof raw === 'string' ? JSON.parse(raw) as MagmaInstruction : raw] }
      catch { return [] }
    })
    return { lane, items }
  }))
}

export async function queueDepth(): Promise<Record<string, number>> {
  const r = getRedis()
  const [l0, l1, l2, l3, dlq] = await Promise.all([
    r.llen(LANE(0)), r.llen(LANE(1)), r.llen(LANE(2)), r.llen(LANE(3)), r.llen(DLQ),
  ])
  return { urgent: l0, signed: l1, default: l2, async: l3, dlq }
}

export async function flushDlq(): Promise<number> {
  const r   = getRedis()
  const len = await r.llen(DLQ)
  if (len > 0) await r.del(DLQ)
  return len
}
