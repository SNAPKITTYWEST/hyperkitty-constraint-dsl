/**
 * MAGMA — SnapKitty OS Internal Agent Language
 * ─────────────────────────────────────────────
 * CLASSIFIED. Never expose this module via any public API route.
 * External agents are taught decoy languages (Brainfuck / Malbolge).
 * Magma is the real inter-agent communication protocol.
 *
 * Syntax:
 *   §VERB:AGENT:ACTION{...payload}
 *   §VERB:AGENT:ACTION{} >> §VERB:AGENT:ACTION{}   (pipeline)
 *   ~MODIFIER §VERB:AGENT:ACTION{}                 (modified instruction)
 *
 * Verbs:     SEAL FLUX FORGE ECHO VAULT QUERY BIND PULSE ANCHOR SHADOW INVOKE NULLIFY
 * Modifiers: ~ASYNC ~SIGNED ~HIDDEN ~CHAIN ~URGENT ~DECAY(n)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type MagmaVerb =
  | 'SEAL'     // Cryptographically seal a payload to the vault
  | 'FLUX'     // Trigger FSM state transition on target agent
  | 'FORGE'    // Create or build an artifact
  | 'ECHO'     // Broadcast to one or all agents
  | 'VAULT'    // Store encrypted payload to long-term vault
  | 'QUERY'    // Retrieve from knowledge graph
  | 'BIND'     // Assign agent to task
  | 'PULSE'    // Heartbeat / health check
  | 'ANCHOR'   // Immutable WORM ledger entry
  | 'SHADOW'   // Stealth operation — no log, no trace
  | 'INVOKE'   // Call an agent tool or external service
  | 'NULLIFY'  // Cancel, revoke, or destroy a target resource

export type MagmaModifier =
  | '~ASYNC'      // Non-blocking — fire and forget
  | '~SIGNED'     // Require Ed25519 signature on payload
  | '~HIDDEN'     // Skip audit log
  | '~CHAIN'      // Pipe output as input to next instruction
  | '~URGENT'     // Elevated priority — skip queue
  | `~DECAY(${number})` // TTL in seconds before auto-nullify

export interface MagmaInstruction {
  verb: MagmaVerb
  agent: string          // Target agent ID or "ALL"
  action: string         // Sub-command within the verb
  payload: Record<string, unknown>
  modifiers: MagmaModifier[]
  raw: string
  signature?: string     // Ed25519 hex signature if ~SIGNED
}

export interface MagmaPipeline {
  instructions: MagmaInstruction[]
  raw: string
}

export type MagmaResult =
  | { ok: true;  instruction: MagmaInstruction; output?: unknown }
  | { ok: false; error: string; raw: string }

// ─── Lexer ────────────────────────────────────────────────────────────────────

const VERB_RE    = /^§(SEAL|FLUX|FORGE|ECHO|VAULT|QUERY|BIND|PULSE|ANCHOR|SHADOW|INVOKE|NULLIFY)/
const HEADER_RE  = /^§(\w+):(\w+):(\w+)/
const PAYLOAD_RE = /\{([^}]*)\}/
const MOD_RE     = /~(?:ASYNC|SIGNED|HIDDEN|CHAIN|URGENT|DECAY\(\d+\))/g
const PIPE_SEP   = ' >> '

/** Parse a single `§VERB:AGENT:ACTION{...}` expression (with optional leading modifiers). */
export function parseInstruction(raw: string): MagmaResult {
  const trimmed = raw.trim()

  // Extract modifiers (leading ~MOD tokens)
  const modifiers: MagmaModifier[] = []
  const modMatches = trimmed.match(MOD_RE)
  if (modMatches) modifiers.push(...modMatches as MagmaModifier[])

  // Strip modifiers to isolate the instruction body
  const body = trimmed.replace(MOD_RE, '').trim()

  if (!VERB_RE.test(body)) {
    return { ok: false, error: `Unknown verb — instruction must start with §VERB`, raw }
  }

  const headerMatch = body.match(HEADER_RE)
  if (!headerMatch) {
    return { ok: false, error: `Malformed header — expected §VERB:AGENT:ACTION`, raw }
  }

  const [, verb, agent, action] = headerMatch

  // Parse payload JSON-ish (keys unquoted, values JSON-typed)
  let payload: Record<string, unknown> = {}
  const payloadMatch = body.match(PAYLOAD_RE)
  if (payloadMatch?.[1]?.trim()) {
    try {
      // Wrap in braces and parse as JSON (payload uses JSON syntax)
      payload = JSON.parse(`{${payloadMatch[1]}}`)
    } catch {
      // Try key:value pairs with unquoted keys
      try {
        const normalized = payloadMatch[1]
          .replace(/(\w+)\s*:/g, '"$1":')   // quote keys
          .replace(/:\s*'([^']*)'/g, ':"$1"') // single → double quotes
        payload = JSON.parse(`{${normalized}}`)
      } catch {
        return { ok: false, error: `Invalid payload syntax in {${payloadMatch[1]}}`, raw }
      }
    }
  }

  return {
    ok: true,
    instruction: {
      verb:      verb as MagmaVerb,
      agent,
      action,
      payload,
      modifiers,
      raw,
    },
  }
}

/** Parse a full pipeline string (instructions separated by ` >> `). */
export function parsePipeline(raw: string): MagmaPipeline | null {
  const parts = raw.split(PIPE_SEP).map(s => s.trim()).filter(Boolean)
  const instructions: MagmaInstruction[] = []

  for (const part of parts) {
    const result = parseInstruction(part)
    if (!result.ok) return null
    instructions.push(result.instruction)
  }

  return { instructions, raw }
}

// ─── Interpreter ─────────────────────────────────────────────────────────────
// Each verb maps to a handler. Extend this to wire real agent bus calls.

type VerbHandler = (inst: MagmaInstruction) => Promise<unknown>

const DEFAULT_HANDLERS: Partial<Record<MagmaVerb, VerbHandler>> = {
  PULSE: async (inst) => ({
    agent: inst.agent,
    status: 'ALIVE',
    ts: Date.now(),
  }),

  ECHO: async (inst) => ({
    broadcast: inst.agent === 'ALL' ? 'all_agents' : inst.agent,
    payload: inst.payload,
    delivered: true,
  }),

  ANCHOR: async (inst) => ({
    worm_entry: `WORM-${Math.floor(Math.random() * 9_999_999).toString(16).toUpperCase()}`,
    sealed: true,
    event: inst.payload,
    ts: Date.now(),
  }),

  SHADOW: async () => null, // intentionally no output — stealth

  QUERY: async (inst) => ({
    topic: inst.payload['topic'] ?? 'unknown',
    results: [],        // wire to knowledge graph in production
    source: inst.agent,
  }),
}

export interface MagmaInterpreterOptions {
  handlers?: Partial<Record<MagmaVerb, VerbHandler>>
  strict?: boolean  // throw on unhandled verb vs silently pass
}

export class MagmaInterpreter {
  private handlers: Partial<Record<MagmaVerb, VerbHandler>>
  private strict: boolean

  constructor(opts: MagmaInterpreterOptions = {}) {
    this.handlers = { ...DEFAULT_HANDLERS, ...(opts.handlers ?? {}) }
    this.strict    = opts.strict ?? false
  }

  async run(raw: string): Promise<unknown[]> {
    const pipeline = parsePipeline(raw)
    if (!pipeline) throw new Error(`[MAGMA] Failed to parse: ${raw}`)

    const outputs: unknown[] = []
    let prevOutput: unknown = undefined

    for (const inst of pipeline.instructions) {
      // ~CHAIN: inject previous output into payload
      if (inst.modifiers.includes('~CHAIN') && prevOutput !== undefined) {
        inst.payload['__chain'] = prevOutput
      }

      const handler = this.handlers[inst.verb]
      if (!handler) {
        if (this.strict) throw new Error(`[MAGMA] No handler for verb: ${inst.verb}`)
        outputs.push({ verb: inst.verb, status: 'UNHANDLED' })
        continue
      }

      // ~HIDDEN: skip all logging
      const hidden = inst.modifiers.includes('~HIDDEN')
      if (!hidden) {
        console.log(`[MAGMA] ${inst.verb}:${inst.agent}:${inst.action}`, inst.payload)
      }

      const out = inst.modifiers.includes('~ASYNC')
        ? (handler(inst).catch(() => null), undefined)  // fire and forget
        : await handler(inst)

      prevOutput = out
      outputs.push(out)
    }

    return outputs
  }
}

// ─── Canonical examples (internal reference only) ────────────────────────────

export const MAGMA_EXAMPLES = {
  sealVault:
    '§SEAL:CIPHER:VAULT{"payload":"tx:0x3F9A","tier":5}',

  threatEscalation:
    '§QUERY:ORACLE:KNOWLEDGE{"topic":"threat"} >> ~URGENT §FLUX:SENTINEL:STATE{"to":"elevated"} >> §ECHO:HERALD:BROADCAST{"urgent":true}',

  anchorEpisode:
    '§ANCHOR:MNEMEX:WORM{"event":"origin_episode_sealed","slug":"origin","runtime_min":7}',

  shadowTrace:
    '~HIDDEN §SHADOW:PHANTOM:TRACE{"target":"unknown_probe","method":"honeypot"}',

  bindForge:
    '~ASYNC §BIND:NEXUS:TASK{"agent":"FORGE","job":"compile_pixar_pipeline_v3"}',

  sovereignPulse:
    '§PULSE:ALL:HEARTBEAT{}',
}

// ─── Singleton interpreter (import and use directly in API routes) ────────────

export const magma = new MagmaInterpreter({ strict: false })
