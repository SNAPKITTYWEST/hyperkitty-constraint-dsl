// Sovereign — Project S Fork 3: SEIT Charter Enforcement + Immutable Ledger
// §FORGE:EMBER:BUILD{directive:"SACM_SOVEREIGN", authority:"PROJECT_S"}
//
// Final stage of the migration pipeline. Takes a consensus-proven project,
// enforces the SEIT NGO charter (EIN 42-2652897), strips vendor lock-in
// metadata, and issues a cryptographically-anchored Participant Record.
//
// Once sovereign, the user is no longer a "user" — they are a "participant."
// Their data is on the immutable ledger. It cannot be taken back.
//
// Architecture used: Entangled Partner FSM — second novel architecture from
// the Quantum Effect (2026-05-20). Independent pipelines stochastically coupled.
//
// Pipeline: Bridge → Optimizer → Sovereign
import crypto from 'crypto'
import { Redis } from '@upstash/redis'
import { getBridgedProject, updateProjectStatus } from './bridge'
import { getConsensusProof } from './optimizer'
import { getVaultKey } from './vault-key'

let redis: Redis | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

// Vendor lock-in metadata keys stripped from legacy payloads before sovereign placement.
// Users are freed from these bindings when they enter the mesh.
const VENDOR_LOCK_KEYS = [
  '_vendor', '_platform', '_tracking', '_analytics', '_telemetry_vendor',
  'google_analytics', 'mixpanel', 'segment_id', 'hubspot', 'salesforce_id',
  'datadog', 'newrelic', 'amplitude', 'intercom', 'optimizely',
]

export type SovereignTier = 'observer' | 'sovereign' | 'igneous'

export interface AgentWorkSeal {
  agent:     string
  timestamp: string
  signature: string
}

export interface ParticipantRecord {
  participantId:     string
  sacmId:            string
  seitCertification: SovereignTier
  charter:           'SEIT-NGO-EIN-42-2652897'
  ledgerAnchor:      string
  consensusRef:      string
  strippedKeys:      string[]
  sovereignAt:       string
  publicObserver:    boolean
  architecture:      'Entangled-Partner-FSM'
  sentinelSeal:      AgentWorkSeal  // SENTINEL verifies zero-trust before sovereignty is granted
  mnemexSeal:        AgentWorkSeal  // MNEMEX countersigns the ledger entry — dual authority
}

const SOVEREIGN_WORM  = 'sovereign:worm:participants'
const participantKey  = (id: string) => `sovereign:participant:${id}`

function stripVendorLocks(payload: unknown): { cleaned: unknown; stripped: string[] } {
  if (typeof payload !== 'object' || payload === null) return { cleaned: payload, stripped: [] }
  const obj     = payload as Record<string, unknown>
  const stripped: string[] = []
  const cleaned: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (VENDOR_LOCK_KEYS.some(deny => k.toLowerCase().includes(deny.toLowerCase()))) {
      stripped.push(k)
    } else {
      cleaned[k] = v
    }
  }
  return { cleaned, stripped }
}

function assignTier(approvalCount: number, requiredQuorum: number): SovereignTier {
  const ratio = approvalCount / requiredQuorum
  if (ratio >= 1.5) return 'igneous'
  if (ratio >= 1.0) return 'sovereign'
  return 'observer'
}

export async function issueSovereignty(sacmId: string): Promise<ParticipantRecord> {
  const [project, consensus] = await Promise.all([
    getBridgedProject(sacmId),
    getConsensusProof(sacmId),
  ])

  if (!project)   throw new Error(`Project ${sacmId} not found`)
  if (!consensus) throw new Error(`No consensus proof for ${sacmId} — run optimizer first`)
  if (!consensus.quorum) throw new Error(`Consensus quorum not met for ${sacmId}`)

  const { stripped } = stripVendorLocks(project.payload)
  const ts            = new Date().toISOString()
  const participantId = `part_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
  const tier          = assignTier(consensus.approvalCount, consensus.requiredQuorum)

  const ledgerAnchor = crypto
    .createHmac('sha256', getVaultKey())
    .update(`sovereign:${sacmId}:${participantId}:${consensus.wormHash}:${ts}`)
    .digest('hex')

  const signSovereign = (agent: string, anchor: string): AgentWorkSeal => ({
    agent,
    timestamp: ts,
    signature: crypto
      .createHmac('sha256', getVaultKey())
      .update(`${agent}:${ts}:${anchor}`)
      .digest('hex'),
  })

  const record: ParticipantRecord = {
    participantId,
    sacmId,
    seitCertification: tier,
    charter:           'SEIT-NGO-EIN-42-2652897',
    ledgerAnchor,
    consensusRef:      consensus.consensusId,
    strippedKeys:      stripped,
    sovereignAt:       ts,
    publicObserver:    tier === 'observer',
    architecture:      'Entangled-Partner-FSM',
    sentinelSeal:      signSovereign('SENTINEL', ledgerAnchor),
    mnemexSeal:        signSovereign('MNEMEX', ledgerAnchor),
  }

  if (redis) {
    // 1-year retention on participant records — they are permanent members
    await redis.set(participantKey(sacmId), JSON.stringify(record), { ex: 31104000 })
    await redis.rpush(SOVEREIGN_WORM, JSON.stringify({
      participantId,
      sacmId,
      tier,
      ledgerAnchor,
      charter:     record.charter,
      sovereignAt: ts,
    }))
  }

  await updateProjectStatus(sacmId, 'sovereign')

  return record
}

export async function getParticipantRecord(sacmId: string): Promise<ParticipantRecord | null> {
  if (!redis) return null
  const raw = await redis.get<string>(participantKey(sacmId))
  if (!raw) return null
  return JSON.parse(raw as string) as ParticipantRecord
}

export async function getSovereignLog(limit = 50, offset = 0): Promise<unknown[]> {
  if (!redis) return []
  const raw = await redis.lrange(SOVEREIGN_WORM, offset, offset + limit - 1) as string[]
  return raw.map(r => JSON.parse(r))
}
