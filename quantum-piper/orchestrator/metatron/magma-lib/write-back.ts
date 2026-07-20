// CLASSIFIED — Write-back protocol.
// After an agent seals a decision, this pipeline extracts the content,
// SIGNS it with Ed25519 (sovereign provenance), embeds it, writes to
// shared KnowledgeChunk, registers the hash, and optionally extracts
// entities into the graph.
// Every chunk that hits the knowledge store carries an embedded §SEAL header
// so future retrieval can verify provenance without contacting a remote authority.
// Called from lib/agent/fsm.ts SEAL_AND_STORE state — fire-and-forget.
import crypto from 'crypto'
import { storeChunk } from '../knowledge/vector-store'
import { storeNode, storeEdge } from '../knowledge/graph'
import { registerChunk } from './chunk-registry'
import { buildInstruction, enqueue } from './queue'
import { signDecision } from '../crypto-vault'
import { stirPool } from './entropy'
import type { AgentKey } from './schema'
import { canWrite } from './schema'

export interface WriteBackInput {
  agentKey:   AgentKey
  sessionId:  string
  query:      string
  reply:      string
  seal:       string           // Ed25519 seal
  wormId:     string
  confidence: number
  topic?:     string
}

// Simple entity extractor — looks for ALLCAPS tokens as named entities
function extractEntities(text: string): string[] {
  return [...new Set(
    (text.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [])
      .filter(e => !['THE', 'AND', 'FOR', 'NOT', 'ARE', 'HAS', 'WAS', 'ALL'].includes(e))
  )].slice(0, 8)
}

export async function writeBack(input: WriteBackInput): Promise<{ chunkId: string | null; hash: string | null }> {
  if (!canWrite(input.agentKey, 'KnowledgeChunk')) {
    return { chunkId: null, hash: null }
  }

  const content = [
    `[${input.agentKey}] Q: ${input.query.slice(0, 300)}`,
    `A: ${input.reply.slice(0, 800)}`,
    `seal:${input.seal.slice(0, 16)} worm:${input.wormId}`,
  ].join('\n')

  // Content hash — basis for Ed25519 signature
  const contentHash = crypto.createHash('sha256').update(content).digest('hex')

  // Ed25519 sign before hitting the knowledge store.
  // The §SEAL header embedded in the chunk is the sovereign provenance proof —
  // any future reader can verify the chunk was written by a legitimate agent seal.
  const signed = signDecision({
    agent:      input.agentKey,
    reply:      input.reply.slice(0, 200),
    seal:       contentHash,
    approved:   true,
    confidence: input.confidence,
  })
  const signedContent = `§SEAL:${input.agentKey}:${signed.sig.slice(0, 32)}:${signed.ts}\n${content}`

  // Stir sovereign entropy pool with this seal event
  stirPool(`${input.agentKey}:${contentHash}:${signed.ts}`)

  const chunkId = await storeChunk({
    source:  'agent_output',
    topic:   input.topic ?? input.agentKey.toLowerCase(),
    content: signedContent,
    level:   1,
  })

  if (!chunkId) return { chunkId: null, hash: null }

  const hash = await registerChunk(chunkId, signedContent)

  // Entity extraction → graph nodes (best-effort, non-blocking)
  if (canWrite(input.agentKey, 'KnowledgeNode')) {
    const entities = extractEntities(input.reply)
    const stored: string[] = []

    for (const name of entities) {
      try {
        const nodeId = await storeNode({
          entityType:  'agent_concept',
          name,
          description: `Extracted from ${input.agentKey} decision. worm:${input.wormId}`,
          metadata:    { source: 'write_back', agentKey: input.agentKey, confidence: input.confidence },
        })
        if (nodeId) stored.push(name)
      } catch { /* non-fatal */ }
    }

    // Chain extracted entities together as co-occurring concepts
    for (let i = 0; i < stored.length - 1; i++) {
      try {
        await storeEdge(stored[i], stored[i + 1], 'co_occurs', input.confidence)
      } catch { /* non-fatal */ }
    }
  }

  // Emit §ANCHOR:MNEMEX instruction into the queue so other agents know new knowledge arrived
  const instr = buildInstruction(
    'ANCHOR', 'MNEMEX', 'KNOWLEDGE_COMMITTED',
    { chunkId, hash: contentHash.slice(0, 16), agent: input.agentKey, wormId: input.wormId },
    ['~ASYNC'],
  )
  await enqueue(instr).catch(() => { /* queue full is non-fatal */ })

  return { chunkId, hash }
}
