/**
 * Sovereign FSM
 *
 * Each agent runs a 6-phase reasoning state machine:
 *   perceive → reason → plan → act → observe → report
 *
 * Phases are sequential per agent (each phase feeds the next as context).
 * Multiple agents run in parallel via Promise.all() — no coordination needed
 * until NEXUS or NOVA collects the outputs.
 *
 * Every phase transition is WORM-sealed with: agent, phase, output hash, seal.
 *
 * Usage:
 *   import { SovereignFSM, runParallelFSMs } from './sovereign_fsm.mjs'
 *
 *   // Single agent:
 *   const fsm = new SovereignFSM('sentinel')
 *   const result = await fsm.run('Analyze this payload: <script>alert(1)</script>')
 *
 *   // Parallel agents:
 *   const results = await runParallelFSMs(
 *     ['sentinel', 'cipher', 'vault'],
 *     'New vendor ACME Corp requests $200K PO. Incorporated 12 days ago.',
 *   )
 */

import { appendFileSync } from 'fs'
import { createHash } from 'crypto'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { callAgent, AGENTS } from './bedrock_agent_router.mjs'

const __dir = dirname(fileURLToPath(import.meta.url))
const WORM_FILE = join(__dir, '.sovereign-fsm-worm.jsonl')

// ── FSM phases ────────────────────────────────────────────────────────────────

export const PHASES = ['perceive', 'reason', 'plan', 'act', 'observe', 'report']

// Phase instructions injected after the agent's base system context.
// Each phase sees all prior phase outputs — the context window IS the reasoning chain.
const PHASE_INSTRUCTIONS = {
  perceive: `SOVEREIGN FSM — PHASE: PERCEIVE
Read the input. List ONLY what you observe: key signals, actors, entities, data values, anomalies.
No interpretation. No judgment. Exhaustive and literal. Bullet points only.`,

  reason: `SOVEREIGN FSM — PHASE: REASON
Using your PERCEIVE output, analyze: patterns, relationships, implications, risks.
Think step by step. Identify cause → effect chains. Flag contradictions.
This is your internal reasoning — be thorough and explicit.`,

  plan: `SOVEREIGN FSM — PHASE: PLAN
Based on REASON, propose concrete actions:
- Numbered list of tool_request calls needed
- Decisions to make
- Verifications required before acting
- Dependencies: what must happen before what
Do not act yet. Only plan.`,

  act: `SOVEREIGN FSM — PHASE: ACT
Execute the plan. Issue your tool_request calls. Make sovereign determinations.
This is your primary output — use your agent role prefix (SENTINEL VERDICT:, CIPHER ANALYSIS:, etc.).
Be specific. Include risk scores, seal references, or GL entries as your role requires.`,

  observe: `SOVEREIGN FSM — PHASE: OBSERVE
Review the ACT output:
- Are all tool_requests properly formed?
- Are there gaps or missing verifications?
- Does the output contradict anything from PERCEIVE or REASON?
- Is anything in your forbidden_outputs list present?
Flag any issues. If clean: state "OBSERVE: no issues detected."`,

  report: `SOVEREIGN FSM — PHASE: REPORT
Synthesize into a final sovereign response.
Include:
1. Your agent prefix and verdict
2. One-sentence reasoning chain summary
3. Any pending tool_request calls the executor must resolve
4. WORM seal instruction if a state change occurred
This is the output that other agents and humans will read.`,
}

// ── WORM seal ─────────────────────────────────────────────────────────────────

let _prevSeal = '0'.repeat(64)

function wormSeal(entry) {
  const raw    = JSON.stringify({ ...entry, prev: _prevSeal })
  const seal   = createHash('sha256').update(raw).digest('hex')
  const sealed = { ...entry, prev: _prevSeal, seal, timestamp: new Date().toISOString() }
  appendFileSync(WORM_FILE, JSON.stringify(sealed) + '\n')
  _prevSeal = seal
  return seal
}

// ── SovereignFSM ──────────────────────────────────────────────────────────────

export class SovereignFSM {
  constructor(agentName) {
    const agent = AGENTS[agentName.toLowerCase()]
    if (!agent) throw new Error(`Unknown agent: ${agentName}`)
    this.agentName = agentName.toLowerCase()
    this.agent     = agent
    this.state     = 'idle'
    this.phases    = {}
    this.log       = []
    this.startedAt = null
    this.finishedAt = null
  }

  // ── Internal: call one phase ─────────────────────────────────────────────

  async _runPhase(phase, context) {
    const instruction = PHASE_INSTRUCTIONS[phase]
    const fullPrompt  = `${context}\n\n---\n${instruction}`

    // Max tokens grows with phase depth — later phases have more context to synthesize
    const phaseIdx   = PHASES.indexOf(phase)
    const maxTokens  = phaseIdx < 2 ? 600 : phaseIdx < 4 ? 900 : 1200

    // Use the agent's own Bedrock model for every phase
    const result = await callAgent(this.agentName, fullPrompt, { maxTokens })
    return result.reply
  }

  // ── Main run loop ────────────────────────────────────────────────────────

  async run(input) {
    this.startedAt = Date.now()
    this.state     = 'running'

    let context = `INPUT TO ${this.agentName.toUpperCase()}:\n${input}`

    const runId = createHash('sha256')
      .update(this.agentName + input + this.startedAt)
      .digest('hex').slice(0, 12)

    wormSeal({
      event:  'FSM_START',
      agent:  this.agentName,
      run_id: runId,
      model:  this.agent.model,
    })

    for (const phase of PHASES) {
      const phaseStart = Date.now()
      const output     = await this._runPhase(phase, context)

      this.phases[phase] = output
      this.state         = phase

      // Accumulate context — next phase sees all prior outputs
      context += `\n\n--- ${phase.toUpperCase()} ---\n${output}`

      const outputHash = createHash('sha256').update(output).digest('hex')
      const seal = wormSeal({
        event:       'FSM_PHASE',
        agent:       this.agentName,
        run_id:      runId,
        phase,
        output_hash: outputHash,
        latency_ms:  Date.now() - phaseStart,
      })

      this.log.push({ phase, latency_ms: Date.now() - phaseStart, seal })
    }

    this.state      = 'complete'
    this.finishedAt = Date.now()

    const totalMs = this.finishedAt - this.startedAt
    wormSeal({
      event:     'FSM_COMPLETE',
      agent:     this.agentName,
      run_id:    runId,
      total_ms:  totalMs,
      phases_ok: PHASES.length,
    })

    // ── Emit resonance seal (sovereign heartbeat) ─────────────────────────
    // Ω↺Ψ↺Δ↺Λ↺Σ↺Φ↺α — proof the 6-phase cycle was coherent and reversible
    const resonanceSeal = emitResonanceSeal(this.agentName, runId, PHASES)
    process.stdout.write('\n' + renderResonanceBox(resonanceSeal) + '\n')

    return {
      agent:          this.agentName,
      model:          this.agent.model,
      run_id:         runId,
      phases:         this.phases,
      report:         this.phases.report,
      log:            this.log,
      total_ms:       totalMs,
      resonance_seal: resonanceSeal,
      delivery:       this.phases.report,
    }
  }
}

// ── Parallel runner ───────────────────────────────────────────────────────────
//
// Fires multiple agent FSMs simultaneously via Promise.all().
// Each FSM is internally sequential (phases build on each other),
// but agents don't wait for each other — they run independently.
//
// prompts: string (same for all) or string[] (one per agent)

export async function runParallelFSMs(agentNames, prompts) {
  const tasks = agentNames.map((name, i) => {
    const prompt = Array.isArray(prompts) ? (prompts[i] ?? prompts[0]) : prompts
    const fsm    = new SovereignFSM(name)
    return fsm.run(prompt)
  })
  return Promise.all(tasks)
}

// ── Override callAgent to accept optional maxTokens ───────────────────────────
// Patch callAgent to support per-phase token limits without touching the router.
// We re-export a wrapped version.

import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { injectMetaArch } from './meta_transformer_arch.mjs'
import { emitResonanceSeal, renderResonanceBox } from './resonance_envelope.mjs'
import { bedrock } from './bedrock_client.mjs'

// We need to call the model directly here with our maxTokens override
// because callAgent in the router hardcodes 1024.
// Duplicate only the body builder — share the agent registry.

function buildBodyFSM(agent, agentName, userMessage, maxTokens = 1024) {
  const { family } = agent
  // Inject sovereign meta architecture into every system prompt
  const system = injectMetaArch(agentName, agent.system)

  if (family === 'anthropic') {
    return { anthropic_version: 'bedrock-2023-05-31', max_tokens: maxTokens, system, messages: [{ role: 'user', content: userMessage }] }
  }

  if (family === 'meta') {
    const prompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${system}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${userMessage}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`
    return { prompt, max_gen_len: maxTokens, temperature: 0.4 }
  }

  if (family === 'nova') {
    return {
      schemaVersion: 'messages-v1',
      system:        [{ text: system }],
      messages:      [{ role: 'user', content: [{ text: userMessage }] }],
      inferenceConfig: { maxTokens, temperature: 0.4 },
    }
  }

  return {
    messages:    [{ role: 'system', content: system }, { role: 'user', content: userMessage }],
    max_tokens:  maxTokens,
    temperature: 0.4,
  }
}

function parseReplyFSM(family, data) {
  if (family === 'anthropic') return data?.content?.[0]?.text ?? ''
  if (family === 'meta')      return data?.generation ?? ''
  if (family === 'nova')      return data?.output?.message?.content?.[0]?.text ?? ''
  return data?.choices?.[0]?.message?.content ?? ''
}

// Patch SovereignFSM._runPhase to use our local bedrock client with maxTokens
SovereignFSM.prototype._runPhase = async function(phase, context) {
  const instruction = PHASE_INSTRUCTIONS[phase]
  const fullPrompt  = `${context}\n\n---\n${instruction}`

  const phaseIdx  = PHASES.indexOf(phase)
  const maxTokens = phaseIdx < 2 ? 600 : phaseIdx < 4 ? 900 : 1200

  const body = buildBodyFSM(this.agent, this.agentName, fullPrompt, maxTokens)

  const cmd = new InvokeModelCommand({
    modelId:     this.agent.model,
    contentType: 'application/json',
    accept:      'application/json',
    body:        new TextEncoder().encode(JSON.stringify(body)),
  })

  const res  = await bedrock.send(cmd)
  const data = JSON.parse(new TextDecoder().decode(res.body))
  return parseReplyFSM(this.agent.family, data)
}
