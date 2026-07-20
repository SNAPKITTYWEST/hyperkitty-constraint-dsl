// CLASSIFIED — Hash registry of last verified knowledge chunks.
// Prevents stale state: before loading chunks into context, verify
// their content hash matches what was last committed to the registry.
// Redis hash: magma:chunk:registry  field=chunkId  value=SHA256(content+updatedAt)
import crypto from 'crypto'
import { Redis } from '@upstash/redis'

const REGISTRY_KEY = 'magma:chunk:registry'
const STALE_LOG    = 'magma:chunk:stale'
const TTL_SEC      = 60 * 60 * 24 * 7  // 7 days

let redis: Redis | null = null
function r(): Redis {
  if (!redis) redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
  return redis
}

export function hashChunk(content: string, updatedAt?: Date): string {
  const raw = `${content}:${(updatedAt ?? new Date()).toISOString()}`
  return crypto.createHash('sha256').update(raw).digest('hex')
}

// Register a chunk after it's been written — seals its content hash
export async function registerChunk(chunkId: string, content: string, updatedAt?: Date): Promise<string> {
  const hash = hashChunk(content, updatedAt)
  await r().hset(REGISTRY_KEY, { [chunkId]: hash })
  await r().expire(REGISTRY_KEY, TTL_SEC)
  return hash
}

// Verify a batch of chunks before loading into agent context
// Returns { fresh: string[], stale: string[] }
export async function verifyChunks(
  chunks: Array<{ id: string; content: string; updatedAt?: Date }>
): Promise<{ fresh: string[]; stale: string[] }> {
  if (chunks.length === 0) return { fresh: [], stale: [] }

  const ids       = chunks.map(c => c.id)
  const stored    = await r().hmget(REGISTRY_KEY, ...ids) as unknown as (string | null)[]
  const fresh: string[] = []
  const stale: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    const c        = chunks[i]
    const expected = stored[i]
    const actual   = hashChunk(c.content, c.updatedAt)
    if (!expected || expected === actual) {
      fresh.push(c.id)
      // Auto-register if missing
      if (!expected) await registerChunk(c.id, c.content, c.updatedAt)
    } else {
      stale.push(c.id)
      await r().lpush(STALE_LOG, JSON.stringify({ id: c.id, detected: Date.now(), expected, actual }))
    }
  }

  return { fresh, stale }
}

// Evict stale chunks from registry (force re-registration on next write)
export async function evictChunks(chunkIds: string[]): Promise<void> {
  if (chunkIds.length === 0) return
  await r().hdel(REGISTRY_KEY, ...chunkIds)
}

// How many chunks are currently registered
export async function registrySize(): Promise<number> {
  return r().hlen(REGISTRY_KEY)
}

export async function recentStale(n = 20): Promise<Array<{ id: string; detected: number }>> {
  const raws = await r().lrange(STALE_LOG, 0, n - 1) as string[]
  return raws.flatMap(raw => {
    try { return [JSON.parse(raw)] } catch { return [] }
  })
}
