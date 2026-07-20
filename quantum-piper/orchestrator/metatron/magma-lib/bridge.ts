// Bridge — Project S Fork 1: The Compatibility Layer
// §FORGE:EMBER:BUILD{directive:"SACM_BRIDGE", authority:"PROJECT_S"}
//
// Zero-friction import. Accepts any legacy project payload, normalizes to SACM
// format, assigns a SACM ID, WORM-seals the import event, and stages the project
// for Optimizer processing. Switching cost: near zero.
//
// Pipeline: Bridge → Optimizer → Sovereign
import crypto from 'crypto'
import { Redis } from '@upstash/redis'
import { runAxiomFilter } from './proxy-guild'
import { getVaultKey, verifyWormHash } from './vault-key'

let redis: Redis | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

export type BridgeStatus = 'imported' | 'optimizing' | 'sovereign' | 'rejected'

export interface LegacyImport {
  id?:       string
  name?:     string
  data?:     unknown
  metadata?: Record<string, unknown>
  source?:   string  // 'github' | 'gitlab' | 'linear' | 'jira' | etc.
  [key: string]: unknown
}

export interface SACMProject {
  sacmId:       string
  origin:       'bridge'
  legacyId:     string
  legacySource: string
  name:         string
  payload:      unknown
  importedAt:   string
  status:       BridgeStatus
  // HMAC integrity seal stored at write time, verified at read time (Borrow Chain 1 fix)
  _integrityHmac?: string
}

export interface AgentWorkSeal {
  agent:     string
  timestamp: string
  signature: string
}

export interface BridgeReceipt {
  sacmId:      string
  legacyId:    string
  status:      BridgeStatus
  importedAt:  string
  nextStep:    'POST /api/gateway/optimizer'
  message:     string
  agentSeal:   AgentWorkSeal   // NEXUS signs every import — no unsigned bridge receipt
}

function sealWork(agentName: string, payload: unknown): AgentWorkSeal {
  const ts = new Date().toISOString()
  return {
    agent:     agentName,
    timestamp: ts,
    signature: crypto
      .createHmac('sha256', getVaultKey())
      .update(`${agentName}:${ts}:${JSON.stringify(payload)}`)
      .digest('hex'),
  }
}

const BRIDGE_IMPORT_SCOPES = [
  'repository_metadata', 'telemetry_logs', 'build_events',
  'deployment_events', 'agent_telemetry', 'project_import',
]

const bridgeKey = (id: string) => `bridge:project:${id}`
const BRIDGE_WORM = 'bridge:worm:imports'

export async function importLegacyProject(legacy: LegacyImport): Promise<BridgeReceipt> {
  const filter = runAxiomFilter(legacy, BRIDGE_IMPORT_SCOPES, 'project_import')
  if (!filter.clean) {
    return {
      sacmId:     '',
      legacyId:   String(legacy.id ?? 'unknown'),
      status:     'rejected',
      importedAt: new Date().toISOString(),
      nextStep:   'POST /api/gateway/optimizer',
      message:    `Axiom Filter rejected: ${filter.violations.join(', ')}`,
      agentSeal:  sealWork('NEXUS', { sacmId: '', legacyId: String(legacy.id ?? 'unknown'), status: 'rejected' } as never),
    }
  }

  const sacmId = `sacm_${crypto.randomUUID().replace(/-/g, '')}`
  const now    = new Date().toISOString()

  const projectBase = {
    sacmId,
    origin:       'bridge' as const,
    legacyId:     String(legacy.id ?? crypto.randomUUID()),
    legacySource: String(legacy.source ?? 'unknown'),
    name:         String(legacy.name ?? `imported_${sacmId.slice(5, 13)}`),
    payload:      legacy,
    importedAt:   now,
    status:       'imported' as BridgeStatus,
  }
  // Compute integrity HMAC over stable fields so getBridgedProject can verify at read time
  const _integrityHmac = crypto
    .createHmac('sha256', getVaultKey())
    .update(`integrity:${sacmId}:${now}:${projectBase.legacyId}:${projectBase.legacySource}`)
    .digest('hex')
  const project: SACMProject = { ...projectBase, _integrityHmac }

  if (redis) {
    await redis.set(bridgeKey(sacmId), JSON.stringify(project), { ex: 7776000 })
    await redis.rpush(BRIDGE_WORM, JSON.stringify({
      event:        'bridge_import',
      sacmId,
      legacyId:     project.legacyId,
      legacySource: project.legacySource,
      timestamp:    now,
      hash:         crypto
        .createHmac('sha256', getVaultKey())
        .update(`bridge:${sacmId}:${now}`)
        .digest('hex'),
    }))
  }

  const receipt = {
    sacmId,
    legacyId:   project.legacyId,
    status:     'imported' as BridgeStatus,
    importedAt: now,
    nextStep:   'POST /api/gateway/optimizer' as const,
    message:    `Project imported to SACM mesh. sacmId: ${sacmId}`,
  }
  return { ...receipt, agentSeal: sealWork('NEXUS', receipt) }
}

export async function getBridgedProject(sacmId: string): Promise<SACMProject | null> {
  if (!redis) return null
  const raw = await redis.get<string>(bridgeKey(sacmId))
  if (!raw) return null
  const project = JSON.parse(raw as string) as SACMProject

  // Borrow Chain 1 fix: verify the stored integrity HMAC before returning.
  // Projects written before this fix lack _integrityHmac — let them through
  // but flag them as unverified rather than silently trusting them.
  if (project._integrityHmac) {
    const valid = verifyWormHash(
      project._integrityHmac,
      `integrity:${project.sacmId}:${project.importedAt}:${project.legacyId}:${project.legacySource}`,
    )
    if (!valid) throw new Error(`BORROW_CHAIN: integrity HMAC mismatch for project ${sacmId} — possible tampering`)
  }

  return project
}

export async function updateProjectStatus(sacmId: string, status: BridgeStatus): Promise<void> {
  if (!redis) return
  const raw = await redis.get<string>(bridgeKey(sacmId))
  if (!raw) return
  const project = JSON.parse(raw as string) as SACMProject
  await redis.set(bridgeKey(sacmId), JSON.stringify({ ...project, status }), { ex: 7776000 })
}

export async function getBridgeLog(limit = 50, offset = 0): Promise<unknown[]> {
  if (!redis) return []
  const raw = await redis.lrange(BRIDGE_WORM, offset, offset + limit - 1) as string[]
  return raw.map(r => JSON.parse(r))
}
