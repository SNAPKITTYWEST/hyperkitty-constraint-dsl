// CLASSIFIED — Auto-archive middleware.
// Wraps agent chat responses. After the seal is written, fires
// the write-back pipeline asynchronously without blocking the client.
// Wire into pages/api/agents/chat.ts after rustWormSeal() returns.
import { writeBack } from './write-back'
import type { WriteBackInput } from './write-back'

export interface SealedResponse {
  agent:        string
  reply:        string
  seal:         string
  approved:     boolean
  confidence:   number
  worm_entry_id?: string
  rust_seal?:   string
  query?:       string
  sessionId?:   string
  topic?:       string
}

// Call this after you have the sealed response — does not await, does not throw
export function autoArchive(response: SealedResponse): void {
  if (!response.worm_entry_id || !response.reply) return
  if (!response.query) return

  const input: WriteBackInput = {
    agentKey:   response.agent.toUpperCase() as WriteBackInput['agentKey'],
    sessionId:  response.sessionId ?? 'unknown',
    query:      response.query,
    reply:      response.reply,
    seal:       response.seal ?? response.rust_seal ?? '',
    wormId:     response.worm_entry_id,
    confidence: response.confidence ?? 1,
    topic:      response.topic,
  }

  // Fire and forget — never blocks the HTTP response
  writeBack(input).catch(err => {
    console.error('[magma:archive] write-back failed (non-fatal):', err?.message)
  })
}

// Middleware factory for use in API route handlers
// Usage: const archive = createArchiveMiddleware(); archive(sealedResult)
export function createArchiveMiddleware() {
  let callCount  = 0
  let errorCount = 0

  return {
    archive: (response: SealedResponse) => {
      callCount++
      writeBack({
        agentKey:   response.agent.toUpperCase() as WriteBackInput['agentKey'],
        sessionId:  response.sessionId ?? 'unknown',
        query:      response.query ?? '',
        reply:      response.reply,
        seal:       response.seal ?? '',
        wormId:     response.worm_entry_id ?? '',
        confidence: response.confidence ?? 1,
        topic:      response.topic,
      }).catch(() => { errorCount++ })
    },
    stats: () => ({ callCount, errorCount }),
  }
}
