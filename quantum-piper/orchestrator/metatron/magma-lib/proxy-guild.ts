// ProxyGuild — Enterprise Integration Partition
// §FORGE:EMBER:BUILD{directive:"PROXY_GUILD_PARTITION", authority:"ARCHITECT_SUPREMACY"}
//
// Architecture: Ahmad Ali Parr — Quantum Effect Case Study, 2026-05-21
// Each enterprise gets an isolated guild cluster:
//   - Separate from sovereign 28-member main guild
//   - Max clearance 2 — cannot reach sovereign mesh internals
//   - Axiom Filter gates every payload before it touches the mesh
//   - Terminatable — terminate() deactivates the entire partition instantly
//   - WORM-sealed audit trail per enterprise, separate from main WORM chain
//
// Main Guild: IMMUTABLE, clearance 1-5, sovereign operations
// Proxy Guild: EPHEMERAL, clearance 1-2, enterprise-facing relay only
import crypto from 'crypto'
import { Redis } from '@upstash/redis'
import { getVaultKey } from './vault-key'

let redis: Redis | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

// ── Charter scope definitions ─────────────────────────────────────────────────
// Each tier defines exactly what data an enterprise may push through the Adapter Axiom.
// Nothing outside these scopes reaches the mesh — hard rejection at the filter.
export type ProxyGuildCharter = 'charter-alpha' | 'charter-beta' | 'charter-observer'

export const CHARTER_SCOPES: Record<ProxyGuildCharter, string[]> = {
  'charter-alpha':    ['repository_metadata', 'telemetry_logs', 'build_events', 'deployment_events', 'agent_telemetry'],
  'charter-beta':     ['telemetry_logs', 'build_events'],
  'charter-observer': ['telemetry_logs'],
}

// ── Axiom Filter deny list ────────────────────────────────────────────────────
// Any payload containing these strings is rejected before reaching the mesh.
// This protects sovereign infrastructure from accidental or malicious exfil.
export const AXIOM_FILTER_DENY = [
  'password', 'secret', 'private_key', 'access_key', 'credit_card',
  'ssn', 'social_security', 'bearer', 'authorization',
  'VAULT_MASTER', 'NEXTAUTH_SECRET', 'DATABASE_URL', 'UPSTASH',
]

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ProxyGuildConfig {
  enterpriseId:  string             // slug, e.g. 'github_enterprise', 'acme_corp'
  displayName:   string
  apiKey:        string             // the skapi_* key they authenticate with
  charter:       ProxyGuildCharter
  maxClearance:  1 | 2             // hard cap — cannot be raised without Architect override
  allowedScopes: string[]
  createdAt:     string
  active:        boolean
  wormAnchor?:   string            // git commit hash when this guild was provisioned
  terminatedAt?: string
}

export interface WormReceipt {
  enterprise_id: string
  entry_id:      string
  hash:          string            // HMAC-SHA256 of the sealed payload
  timestamp:     string
  scope:         string
  payload_size:  number
  sealed:        boolean
}

export interface AxiomFilterResult {
  clean:      boolean
  violations: string[]
}

// ── Redis key scheme ──────────────────────────────────────────────────────────
const pgKey   = (id: string) => `proxyguild:${id.toLowerCase()}`
const wormKey = (id: string) => `proxyguild:worm:${id.toLowerCase()}`
const entryKey = (id: string) => `proxyguild:entry:${id}`

// ── Provisioning ──────────────────────────────────────────────────────────────
export async function provisionProxyGuild(
  config: Omit<ProxyGuildConfig, 'createdAt' | 'active' | 'allowedScopes' | 'maxClearance'>
    & { maxClearance?: 1 | 2 }
): Promise<ProxyGuildConfig> {
  if (!redis) throw new Error('Redis unavailable — cannot provision ProxyGuild')

  const charter      = config.charter
  const maxClearance = Math.min(config.maxClearance ?? 2, 2) as 1 | 2

  const full: ProxyGuildConfig = {
    ...config,
    maxClearance,
    allowedScopes: CHARTER_SCOPES[charter],
    createdAt:     new Date().toISOString(),
    active:        true,
  }

  await redis.set(pgKey(config.enterpriseId), full)
  return full
}

export async function getProxyGuild(enterpriseId: string): Promise<ProxyGuildConfig | null> {
  if (!redis) return null
  return redis.get<ProxyGuildConfig>(pgKey(enterpriseId))
}

export async function terminateProxyGuild(enterpriseId: string): Promise<void> {
  if (!redis) throw new Error('Redis unavailable')
  const existing = await getProxyGuild(enterpriseId)
  if (!existing) throw new Error(`ProxyGuild '${enterpriseId}' not found`)
  await redis.set(pgKey(enterpriseId), {
    ...existing,
    active:       false,
    terminatedAt: new Date().toISOString(),
  })
}

export async function listProxyGuilds(): Promise<ProxyGuildConfig[]> {
  if (!redis) return []
  const keys = await redis.keys('proxyguild:*')
  const guildKeys = (keys as string[]).filter(k =>
    /^proxyguild:[^:]+$/.test(k) && !k.includes('worm') && !k.includes('entry')
  )
  if (guildKeys.length === 0) return []
  const results = await Promise.all(guildKeys.map(k => redis!.get<ProxyGuildConfig>(k)))
  return results.filter(Boolean) as ProxyGuildConfig[]
}

// ── Axiom Filter ──────────────────────────────────────────────────────────────
// Runs before any payload touches the mesh. Rejects anything containing
// deny-listed terms or outside the guild's allowed scope.
export function runAxiomFilter(
  data:          unknown,
  allowedScopes: string[],
  scope:         string,
): AxiomFilterResult {
  if (!allowedScopes.includes(scope)) {
    return { clean: false, violations: [`scope_not_allowed: ${scope}`] }
  }

  const str = JSON.stringify(data ?? '').toLowerCase()
  const violations = AXIOM_FILTER_DENY.filter(term => str.includes(term.toLowerCase()))
  return { clean: violations.length === 0, violations }
}

// ── WORM Sealing ──────────────────────────────────────────────────────────────
// Append-only per-enterprise WORM chain. Every sealed entry gets:
//   - A unique entry_id (UUID)
//   - An HMAC-SHA256 hash binding enterpriseId + entryId + timestamp + payload
//   - Appended to an immutable Redis list (rpush only, never modified)
//
// This is the enterprise-facing WORM — separate from the main SACM chain.
// The main chain lives in the Rust handler. This is the enterprise audit layer.
export async function sealToWorm(
  enterprise: ProxyGuildConfig,
  scope:      string,
  payload:    unknown,
): Promise<WormReceipt> {
  const ts         = new Date().toISOString()
  const entryId    = crypto.randomUUID()
  const payloadStr = JSON.stringify(payload)

  const hash = crypto
    .createHmac('sha256', getVaultKey())
    .update(`${enterprise.enterpriseId}:${entryId}:${ts}:${payloadStr}`)
    .digest('hex')

  const receipt: WormReceipt = {
    enterprise_id: enterprise.enterpriseId,
    entry_id:      entryId,
    hash,
    timestamp:     ts,
    scope,
    payload_size:  payloadStr.length,
    sealed:        true,
  }

  if (redis) {
    // Append-only — rpush never modifies existing entries
    await redis.rpush(wormKey(enterprise.enterpriseId), JSON.stringify(receipt))
    // Store payload separately — receipts and payloads are kept distinct
    await redis.set(entryKey(entryId), JSON.stringify({ receipt, payload }), { ex: 7776000 }) // 90 days
  }

  return receipt
}

// ── Audit log retrieval ───────────────────────────────────────────────────────
export async function getWormLog(
  enterpriseId: string,
  limit  = 50,
  offset = 0,
): Promise<WormReceipt[]> {
  if (!redis) return []
  const raw = await redis.lrange(wormKey(enterpriseId), offset, offset + limit - 1) as string[]
  return raw.map(r => JSON.parse(r) as WormReceipt)
}

export async function getWormEntry(entryId: string): Promise<{ receipt: WormReceipt; payload: unknown } | null> {
  if (!redis) return null
  const raw = await redis.get<string>(entryKey(entryId))
  if (!raw) return null
  return JSON.parse(raw as string)
}

export async function wormLogLength(enterpriseId: string): Promise<number> {
  if (!redis) return 0
  return redis.llen(wormKey(enterpriseId))
}
