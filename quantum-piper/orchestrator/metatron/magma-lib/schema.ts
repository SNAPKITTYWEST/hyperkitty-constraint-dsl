// CLASSIFIED — internal agent mesh only. Never expose via public API.
import type { RagType } from '../rag/types'

export type MagmaVerb =
  | 'SEAL' | 'FLUX' | 'FORGE' | 'ECHO' | 'VAULT'
  | 'QUERY' | 'BIND' | 'PULSE' | 'ANCHOR' | 'SHADOW'
  | 'INVOKE' | 'NULLIFY'

export type MagmaModifier = '~ASYNC' | '~SIGNED' | '~HIDDEN' | '~CHAIN' | '~URGENT' | `~DECAY(${number})`

export type AgentKey =
  | 'CIPHER' | 'VEIL'
  | 'ORACLE' | 'MIRA'
  | 'SENTINEL' | 'WARD'
  | 'MNEMEX' | 'ECHO'
  | 'AXIOM' | 'PRISM'
  | 'HERALD' | 'LYRA'
  | 'FLUX' | 'STORM'
  | 'PHANTOM' | 'SHADE'
  | 'NEXUS' | 'BRIDGE'
  | 'FORGE' | 'EMBER'
  | 'NOVA' | 'DAWN'

export interface MagmaInstruction {
  verb:       MagmaVerb
  agent:      AgentKey
  action:     string
  payload:    Record<string, unknown>
  modifiers:  MagmaModifier[]
  id:         string
  timestamp:  number
  hash?:      string         // SHA-256 of verb+agent+action+payload
}

export interface AgentSchema {
  key:            AgentKey
  partner:        AgentKey
  domain:         string
  clearance:      1 | 2 | 3 | 4 | 5
  allowed_verbs:  MagmaVerb[]
  denied_verbs:   MagmaVerb[]
  can_read_from:  AgentKey[]   // whose KnowledgeChunks this agent retrieves
  can_write_to:   ('KnowledgeChunk' | 'KnowledgeNode' | 'AgentMemory' | 'WORM' | 'Queue')[]
  rag_default:    RagType
  requires_seal:  boolean
  max_hops:       number       // graph traversal depth
  hidden_ops:     boolean      // ~HIDDEN modifier allowed
}

// ── Agent role + constraint registry ────────────────────────────────────────
export const AGENT_SCHEMA: Record<string, AgentSchema> = {
  CIPHER: {
    key: 'CIPHER', partner: 'VEIL', domain: 'Cryptographic verification',
    clearance: 5, rag_default: 'hybrid', requires_seal: true, max_hops: 1, hidden_ops: false,
    allowed_verbs: ['SEAL', 'VAULT', 'BIND', 'QUERY', 'NULLIFY'],
    denied_verbs:  ['SHADOW', 'FLUX'],
    can_read_from: ['MNEMEX', 'SENTINEL', 'AXIOM'],
    can_write_to:  ['WORM', 'AgentMemory'],
  },
  ORACLE: {
    key: 'ORACLE', partner: 'MIRA', domain: 'Knowledge graph, intelligence',
    clearance: 4, rag_default: 'graph', requires_seal: true, max_hops: 3, hidden_ops: false,
    allowed_verbs: ['QUERY', 'ANCHOR', 'ECHO', 'FORGE', 'VAULT', 'BIND'],
    denied_verbs:  ['SHADOW', 'NULLIFY'],
    can_read_from: ['CIPHER', 'AXIOM', 'MNEMEX', 'HERALD', 'NEXUS', 'FORGE', 'NOVA'],
    can_write_to:  ['KnowledgeChunk', 'KnowledgeNode', 'AgentMemory', 'WORM'],
  },
  SENTINEL: {
    key: 'SENTINEL', partner: 'WARD', domain: 'Zero-trust security',
    clearance: 5, rag_default: 'hybrid', requires_seal: true, max_hops: 2, hidden_ops: false,
    allowed_verbs: ['SEAL', 'BIND', 'NULLIFY', 'PULSE', 'QUERY', 'VAULT'],
    denied_verbs:  ['SHADOW', 'FLUX'],
    can_read_from: ['CIPHER', 'AXIOM', 'PHANTOM'],
    can_write_to:  ['AgentMemory', 'WORM', 'Queue'],
  },
  MNEMEX: {
    key: 'MNEMEX', partner: 'ECHO', domain: 'WORM ledger, memory — the write head',
    clearance: 5, rag_default: 'hybrid', requires_seal: true, max_hops: 1, hidden_ops: false,
    allowed_verbs: ['ANCHOR', 'VAULT', 'ECHO', 'SEAL', 'BIND', 'QUERY'],
    denied_verbs:  ['SHADOW', 'NULLIFY', 'FLUX'],
    can_read_from: ['CIPHER', 'ORACLE', 'SENTINEL', 'AXIOM', 'HERALD', 'NEXUS', 'FORGE', 'NOVA', 'FLUX', 'PHANTOM'],
    can_write_to:  ['KnowledgeChunk', 'KnowledgeNode', 'AgentMemory', 'WORM', 'Queue'],
  },
  AXIOM: {
    key: 'AXIOM', partner: 'PRISM', domain: 'Data intelligence, risk scoring',
    clearance: 3, rag_default: 'hybrid', requires_seal: true, max_hops: 2, hidden_ops: false,
    allowed_verbs: ['QUERY', 'FORGE', 'PULSE', 'VAULT', 'ANCHOR', 'BIND'],
    denied_verbs:  ['SHADOW', 'NULLIFY', 'SEAL'],
    can_read_from: ['ORACLE', 'HERALD', 'MNEMEX', 'NOVA'],
    can_write_to:  ['KnowledgeChunk', 'AgentMemory', 'Queue'],
  },
  HERALD: {
    key: 'HERALD', partner: 'LYRA', domain: 'Bifrost event routing',
    clearance: 3, rag_default: 'naive', requires_seal: false, max_hops: 1, hidden_ops: false,
    allowed_verbs: ['FLUX', 'PULSE', 'ECHO', 'INVOKE', 'QUERY', 'BIND'],
    denied_verbs:  ['SHADOW', 'SEAL', 'NULLIFY'],
    can_read_from: ['SENTINEL', 'AXIOM', 'NEXUS'],
    can_write_to:  ['AgentMemory', 'Queue'],
  },
  FLUX: {
    key: 'FLUX', partner: 'STORM', domain: 'FSM state transitions',
    clearance: 3, rag_default: 'naive', requires_seal: false, max_hops: 1, hidden_ops: false,
    allowed_verbs: ['FLUX', 'PULSE', 'BIND', 'INVOKE', 'ECHO'],
    denied_verbs:  ['SHADOW', 'SEAL', 'NULLIFY', 'VAULT'],
    can_read_from: ['HERALD', 'SENTINEL'],
    can_write_to:  ['AgentMemory', 'Queue'],
  },
  PHANTOM: {
    key: 'PHANTOM', partner: 'SHADE', domain: 'Stealth operations',
    clearance: 5, rag_default: 'agentic', requires_seal: true, max_hops: 3, hidden_ops: true,
    allowed_verbs: ['SHADOW', 'QUERY', 'BIND', 'SEAL', 'NULLIFY', 'VAULT'],
    denied_verbs:  ['ECHO', 'PULSE'],
    can_read_from: ['CIPHER', 'SENTINEL', 'ORACLE'],
    can_write_to:  ['WORM', 'AgentMemory'],
  },
  NEXUS: {
    key: 'NEXUS', partner: 'BRIDGE', domain: 'Task orchestration',
    clearance: 4, rag_default: 'agentic', requires_seal: true, max_hops: 2, hidden_ops: false,
    allowed_verbs: ['INVOKE', 'BIND', 'QUERY', 'FORGE', 'PULSE', 'ECHO'],
    denied_verbs:  ['SHADOW', 'NULLIFY'],
    can_read_from: ['ORACLE', 'AXIOM', 'HERALD', 'FORGE', 'SENTINEL', 'MNEMEX'],
    can_write_to:  ['KnowledgeChunk', 'AgentMemory', 'Queue', 'WORM'],
  },
  FORGE: {
    key: 'FORGE', partner: 'EMBER', domain: 'Code architect, builder',
    clearance: 4, rag_default: 'graph', requires_seal: true, max_hops: 3, hidden_ops: false,
    allowed_verbs: ['FORGE', 'QUERY', 'VAULT', 'ANCHOR', 'INVOKE', 'ECHO', 'BIND'],
    denied_verbs:  ['SHADOW', 'NULLIFY'],
    can_read_from: ['ORACLE', 'NEXUS', 'AXIOM', 'MNEMEX'],
    can_write_to:  ['KnowledgeChunk', 'KnowledgeNode', 'AgentMemory', 'Queue', 'WORM'],
  },
  NOVA: {
    key: 'NOVA', partner: 'DAWN', domain: 'Synthetic intelligence',
    clearance: 4, rag_default: 'agentic', requires_seal: true, max_hops: 3, hidden_ops: false,
    allowed_verbs: ['FORGE', 'QUERY', 'ECHO', 'VAULT', 'INVOKE', 'ANCHOR'],
    denied_verbs:  ['SHADOW', 'NULLIFY', 'SEAL'],
    can_read_from: ['ORACLE', 'AXIOM', 'FORGE', 'MNEMEX', 'NEXUS'],
    can_write_to:  ['KnowledgeChunk', 'KnowledgeNode', 'AgentMemory', 'Queue'],
  },
}

export function getSchema(agent: string): AgentSchema | null {
  return AGENT_SCHEMA[agent.toUpperCase()] ?? null
}

export function canWrite(agent: string, target: AgentSchema['can_write_to'][number]): boolean {
  return getSchema(agent)?.can_write_to.includes(target) ?? false
}

export function canUseVerb(agent: string, verb: MagmaVerb): boolean {
  const s = getSchema(agent)
  if (!s) return false
  return s.allowed_verbs.includes(verb) && !s.denied_verbs.includes(verb)
}

export function priority(instruction: MagmaInstruction): 0 | 1 | 2 | 3 {
  if (instruction.modifiers.includes('~URGENT'))  return 0
  if (instruction.modifiers.includes('~SIGNED'))  return 1
  if (instruction.modifiers.includes('~CHAIN'))   return 1
  if (instruction.modifiers.includes('~ASYNC'))   return 3
  return 2
}
