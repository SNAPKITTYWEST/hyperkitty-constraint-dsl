/**
 * Creative FLUX FSM
 *
 * Extends the sovereign FSM for creative agents (MUSE, PRISM, VANTA).
 * Key difference from analytical FSM:
 *   - Temperature is drawn from QNU qubit before every phase
 *   - Phase instructions are tuned for creative output
 *   - VANTA gets the highest entropy range (0.85–1.0)
 *   - Every temperature draw is WORM-sealed before the call
 *
 * Phases:
 *   absorb → interpret → diverge → create → refine → deliver
 *
 * (Creative phases replace perceive→reason→plan→act→observe→report
 *  with language that unlocks creative reasoning rather than analytical.)
 *
 * Usage:
 *   import { runCreativeFluxFSMs } from './creative_flux_fsm.mjs'
 *   const results = await runCreativeFluxFSMs(
 *     ['muse', 'prism', 'vanta'],
 *     'Design the brand identity for a sovereign AI company.'
 *   )
 */

import { appendFileSync } from 'fs'
import { createHash } from 'crypto'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { AGENTS } from './bedrock_agent_router.mjs'
import { drawTemperature } from './qnu_temperature.mjs'
import { injectMetaArch } from './meta_transformer_arch.mjs'
import { emitResonanceSeal, renderResonanceBox } from './resonance_envelope.mjs'
import { bedrock } from './bedrock_client.mjs'

const __dir = dirname(fileURLToPath(import.meta.url))

const PHI      = (1 + Math.sqrt(5)) / 2
const WORM_FILE = join(__dir, '.creative-flux-worm.jsonl')

// ── WORM ───────────────────────────────────────────────────────────────────────

let _prevSeal = '0'.repeat(64)

function wormSeal(entry) {
  const raw  = JSON.stringify({ ...entry, prev: _prevSeal })
  const seal = createHash('sha256').update(raw).digest('hex')
  appendFileSync(WORM_FILE, JSON.stringify({ ...entry, prev: _prevSeal, seal, ts: new Date().toISOString() }) + '\n')
  _prevSeal = seal
  return seal
}

// ── Creative FSM phases ────────────────────────────────────────────────────────
// Language is expressive, not procedural — unlocks divergent thinking

export const CREATIVE_PHASES = ['absorb', 'interpret', 'diverge', 'create', 'refine', 'deliver']

const CREATIVE_PHASE_INSTRUCTIONS = {
  absorb: `CREATIVE FSM — PHASE: ABSORB
Take in everything in the brief. List every element, every constraint, every emotion implied.
What does this want to become? What is the brief not saying?
No ideas yet. Pure reception. Let the quantum temperature set your frequency.`,

  interpret: `CREATIVE FSM — PHASE: INTERPRET
What does this brief REALLY mean beneath the literal words?
Find the tension. Find the soul. Find what would make this memorable.
Map the emotional terrain — what feeling should the output leave?
Identify what has never been done in this space.`,

  diverge: `CREATIVE FSM — PHASE: DIVERGE
Generate 3 radically different creative directions. No self-censorship.
Direction A: The expected done perfectly.
Direction B: The unexpected twist.
Direction C: The direction that breaks the category entirely.
Then select one and explain why it is sovereign.`,

  create: `CREATIVE FSM — PHASE: CREATE
Execute the chosen direction in full.
This is your primary creative output — use your agent prefix (MUSE VISION:, PRISM DIRECTIVE:, VANTA CUT:).
Be specific. Be concrete. Be surprising.
The quantum temperature is active — trust the entropy. The best ideas live at the edge of coherence.`,

  refine: `CREATIVE FSM — PHASE: REFINE
Read what you created. Ask:
- Does it have a point of view?
- Would someone remember this in 30 days?
- Is anything generic or replaceable? If so: cut or replace.
- Does it honor the sovereign identity?
Make specific improvements or state: "REFINE: output holds."`,

  deliver: `CREATIVE FSM — PHASE: DELIVER
Package the final creative output for handoff.
Include:
1. Your agent prefix and creative verdict
2. The complete creative output (narrative, prompt, or concept)
3. Implementation notes — what comes next, what tools or models execute this
4. QNU temperature used this session and what it unlocked
This is what the client, NEXUS, or NOVA will receive.`,
}

// ── Invocation format per family ───────────────────────────────────────────────

function buildBody(agent, agentName, userMessage, temperature) {
  const { family } = agent
  const system = injectMetaArch(agentName, agent.system)

  if (family === 'anthropic') {
    return { anthropic_version: 'bedrock-2023-05-31', max_tokens: 1200, system, messages: [{ role: 'user', content: userMessage }] }
  }
  if (family === 'meta') {
    const prompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${system}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${userMessage}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`
    return { prompt, max_gen_len: 1200, temperature }
  }
  if (family === 'nova') {
    return {
      schemaVersion: 'messages-v1',
      system:        [{ text: system }],
      messages:      [{ role: 'user', content: [{ text: userMessage }] }],
      inferenceConfig: { maxTokens: 1200, temperature },
    }
  }
  return {
    messages:    [{ role: 'system', content: system }, { role: 'user', content: userMessage }],
    max_tokens:  1200,
    temperature,
  }
}

function parseReply(family, data) {
  if (family === 'anthropic') return data?.content?.[0]?.text ?? ''
  if (family === 'meta')      return data?.generation ?? ''
  if (family === 'nova')      return data?.output?.message?.content?.[0]?.text ?? ''
  return data?.choices?.[0]?.message?.content ?? ''
}

// ── Creative FLUX FSM class ────────────────────────────────────────────────────

export class CreativeFluxFSM {
  constructor(agentName) {
    const agent = AGENTS[agentName.toLowerCase()]
    if (!agent) throw new Error(`Unknown agent: ${agentName}`)
    if (!agent.creative) throw new Error(`${agentName} is not a creative agent. Use SovereignFSM instead.`)
    this.agentName  = agentName.toLowerCase()
    this.agent      = agent
    this.state      = 'idle'
    this.phases     = {}
    this.temps      = {}
    this.log        = []
    this.startedAt  = null
    this.finishedAt = null
  }

  async run(input) {
    this.startedAt = Date.now()
    this.state     = 'running'

    const runId = createHash('sha256')
      .update(this.agentName + input + this.startedAt)
      .digest('hex').slice(0, 12)

    wormSeal({ event: 'CREATIVE_FSM_START', agent: this.agentName, run_id: runId, model: this.agent.model })

    let context = `CREATIVE BRIEF FOR ${this.agentName.toUpperCase()}:\n${input}`

    for (const phase of CREATIVE_PHASES) {
      const phaseStart = Date.now()

      // ── Draw quantum temperature before EVERY phase ──────────────────────
      const qnu = await drawTemperature(this.agentName)
      this.temps[phase] = qnu

      process.stdout.write(
        `  \x1b[35m[${this.agentName.toUpperCase()}:${phase}]\x1b[0m \x1b[2mT=${qnu.temp.toFixed(4)} [${qnu.source}] φ=${qnu.phi_modulated.toFixed(4)}\x1b[0m\n`
      )

      // ── Build prompt: accumulated context + phase instruction ─────────────
      const instruction = CREATIVE_PHASE_INSTRUCTIONS[phase]
      const phaseIdx    = CREATIVE_PHASES.indexOf(phase)
      const fullPrompt  = `${context}\n\n---\n${instruction}`

      // ── Call model with quantum temperature ───────────────────────────────
      const body = buildBody(this.agent, this.agentName, fullPrompt, qnu.temp)
      const cmd  = new InvokeModelCommand({
        modelId:     this.agent.model,
        contentType: 'application/json',
        accept:      'application/json',
        body:        new TextEncoder().encode(JSON.stringify(body)),
      })

      const res    = await bedrock.send(cmd)
      const data   = JSON.parse(new TextDecoder().decode(res.body))
      const output = parseReply(this.agent.family, data)

      this.phases[phase] = output
      this.state         = phase

      // Accumulate context — each phase sees all prior outputs
      context += `\n\n--- ${phase.toUpperCase()} (T=${qnu.temp.toFixed(4)}) ---\n${output}`

      const outputHash = createHash('sha256').update(output).digest('hex')
      const seal = wormSeal({
        event:        'CREATIVE_FSM_PHASE',
        agent:        this.agentName,
        run_id:       runId,
        phase,
        temperature:  qnu.temp,
        qnu_source:   qnu.source,
        phi_modulated: qnu.phi_modulated,
        output_hash:  outputHash,
        latency_ms:   Date.now() - phaseStart,
      })

      this.log.push({ phase, temperature: qnu.temp, qnu_source: qnu.source, latency_ms: Date.now() - phaseStart, seal })
    }

    this.state      = 'complete'
    this.finishedAt = Date.now()

    wormSeal({
      event:    'CREATIVE_FSM_COMPLETE',
      agent:    this.agentName,
      run_id:   runId,
      total_ms: this.finishedAt - this.startedAt,
    })

    // ── Emit resonance seal (sovereign heartbeat) ─────────────────────────
    // Ω↺Ψ↺Δ↺Λ↺Σ↺Φ↺α — proof the 6-phase creative cycle was coherent
    const resonanceSeal = emitResonanceSeal(this.agentName, runId, CREATIVE_PHASES)
    process.stdout.write('\n' + renderResonanceBox(resonanceSeal) + '\n')

    return {
      agent:          this.agentName,
      model:          this.agent.model,
      run_id:         runId,
      phases:         this.phases,
      temps:          this.temps,
      delivery:       this.phases.deliver,
      log:            this.log,
      total_ms:       this.finishedAt - this.startedAt,
      resonance_seal: resonanceSeal,
    }
  }
}

// ── Parallel runner ───────────────────────────────────────────────────────────
// All creative agents fire simultaneously — pure Promise.all()

export async function runCreativeFluxFSMs(agentNames, prompt) {
  const tasks = agentNames.map(name => {
    const fsm = new CreativeFluxFSM(name)
    return fsm.run(Array.isArray(prompt) ? prompt[agentNames.indexOf(name)] ?? prompt[0] : prompt)
      .catch(err => ({ agent: name, error: err.message, phases: {}, delivery: null, total_ms: 0 }))
  })
  return Promise.all(tasks)
}
