/**
 * Sovereign Parallel FSM Test
 *
 * Fires multiple agents' FSMs in parallel.
 * Each agent runs perceive → reason → plan → act → observe → report.
 * All agents start simultaneously — Promise.all() — no waiting on each other.
 * WORM-seals every phase transition of every agent.
 *
 * Usage:
 *   node agent_parallel_fsm.mjs
 *     → fires sentinel + cipher + vault + axiom in parallel on a vendor scenario
 *
 *   node agent_parallel_fsm.mjs --agents sentinel,cipher --prompt "SQL injection detected"
 *     → custom agents + prompt
 *
 *   node agent_parallel_fsm.mjs --agent nexus --prompt "onboard new enterprise client"
 *     → single agent, full FSM trace
 */

import { SovereignFSM, runParallelFSMs, PHASES } from './sovereign_fsm.mjs'
import { AGENTS } from './bedrock_agent_router.mjs'
import { appendFileSync } from 'fs'
import { createHash } from 'crypto'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
  blue:    '\x1b[34m',
  white:   '\x1b[37m',
}

const PHASE_COLORS = {
  perceive: '\x1b[34m',   // blue
  reason:   '\x1b[35m',   // magenta
  plan:     '\x1b[33m',   // yellow
  act:      '\x1b[32m',   // green
  observe:  '\x1b[36m',   // cyan
  report:   '\x1b[1m\x1b[37m',  // bold white
}

// ── Default scenarios ─────────────────────────────────────────────────────────
// When no --prompt given, use this multi-agent scenario (each agent gets same input;
// they reason from their domain perspective independently).

const DEFAULT_SCENARIO = {
  prompt: `SITUATION: New vendor QuantumBridge Solutions LLC has submitted a $200,000 purchase order for infrastructure services.
Facts:
- QuantumBridge was incorporated 12 days ago
- No prior relationship with our company
- Requesting net-30 payment terms
- One reference provided: Apex Digital LLC — incorporated 3 weeks ago
- The PO involves access to our internal API endpoints during service delivery
- The request came in via a procurement email from a domain registered 8 days ago

Analyze this situation from your sovereign role and produce your full reasoning.`,
  agents: ['sentinel', 'cipher', 'vault', 'axiom'],
}

// ── Display helpers ───────────────────────────────────────────────────────────

function header(text, color = C.cyan) {
  const line = '═'.repeat(70)
  console.log(`\n${color}${line}${C.reset}`)
  console.log(`${color}${C.bold}  ${text}${C.reset}`)
  console.log(`${color}${line}${C.reset}`)
}

function phaseBlock(agent, phase, output, latencyMs) {
  const color = PHASE_COLORS[phase] ?? C.white
  const label = `[${agent.toUpperCase()}:${phase.toUpperCase()}]`
  console.log(`\n${color}${C.bold}${label}${C.reset} ${C.dim}${latencyMs}ms${C.reset}`)
  const lines = output.trim().split('\n')
  lines.forEach(l => console.log(`  ${l}`))
}

function agentSummary(result) {
  const totalSec = (result.total_ms / 1000).toFixed(1)
  const agentColor = C.cyan
  console.log(`\n${agentColor}${C.bold}══ ${result.agent.toUpperCase()} COMPLETE ══${C.reset}  ${C.dim}${totalSec}s  model: ${result.model}${C.reset}`)
  console.log(`\n${C.bold}${C.white}REPORT:${C.reset}`)
  result.report.trim().split('\n').forEach(l => console.log(`  ${l}`))
  console.log(`\n${C.dim}  run_id: ${result.run_id}${C.reset}`)
}

// ── Live streaming display ────────────────────────────────────────────────────
// Run FSMs in parallel but display phase outputs as they arrive via event emitter.

class FSMRunner extends SovereignFSM {
  constructor(agentName, onPhase) {
    super(agentName)
    this._onPhase = onPhase
  }

  async run(input) {
    const result = await super.run(input)
    return result
  }
}

// Monkey-patch to emit phase events during run.
// We wrap the internal _runPhase to call onPhase after each completes.
function makeLivefsm(agentName, onPhase) {
  const fsm = new SovereignFSM(agentName)
  const origRunPhase = fsm._runPhase.bind(fsm)
  let phaseIdx = 0

  // Wrap run() to emit events
  const origRun = fsm.run.bind(fsm)
  fsm.run = async function(input) {
    // Override _runPhase on this instance
    const self = this
    self._runPhase = async function(phase, context) {
      const start  = Date.now()
      const output = await origRunPhase(phase, context)
      const ms     = Date.now() - start
      onPhase(agentName, phase, output, ms)
      return output
    }
    return origRun(input)
  }

  return fsm
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args      = process.argv.slice(2)
  const dryRun    = args.includes('--dry-run')

  let agentNames, prompt

  if (args.includes('--agents')) {
    agentNames = args[args.indexOf('--agents') + 1].split(',').map(s => s.trim().toLowerCase())
  } else if (args.includes('--agent')) {
    agentNames = [args[args.indexOf('--agent') + 1].trim().toLowerCase()]
  } else {
    agentNames = DEFAULT_SCENARIO.agents
  }

  if (args.includes('--prompt')) {
    prompt = args[args.indexOf('--prompt') + 1]
  } else {
    prompt = DEFAULT_SCENARIO.prompt
  }

  // Validate agents
  for (const name of agentNames) {
    if (!AGENTS[name]) {
      console.error(`${C.red}Unknown agent: ${name}. Available: ${Object.keys(AGENTS).join(', ')}${C.reset}`)
      process.exit(1)
    }
  }

  // ── Banner ─────────────────────────────────────────────────────────────────

  console.log(`${C.magenta}${C.bold}`)
  console.log('  ███████╗███████╗███╗   ███╗  ██████╗  █████╗ ██████╗  █████╗ ██╗     ')
  console.log('  ██╔════╝██╔════╝████╗ ████║  ██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║     ')
  console.log('  █████╗  ███████╗██╔████╔██║  ██████╔╝███████║██████╔╝███████║██║     ')
  console.log('  ██╔══╝  ╚════██║██║╚██╔╝██║  ██╔═══╝ ██╔══██║██╔══██╗██╔══██║██║     ')
  console.log('  ██║     ███████║██║ ╚═╝ ██║  ██║     ██║  ██║██║  ██║██║  ██║███████╗')
  console.log('  ╚═╝     ╚══════╝╚═╝     ╚═╝  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝')
  console.log(`${C.reset}`)
  console.log(`${C.bold}  SOVEREIGN PARALLEL FSM${C.reset}  ${C.dim}${new Date().toISOString()}${C.reset}`)
  console.log(`  Agents (${agentNames.length} parallel): ${C.cyan}${agentNames.join(', ')}${C.reset}`)
  console.log(`  Phases (${PHASES.length} sequential): ${C.dim}${PHASES.join(' → ')}${C.reset}`)
  if (dryRun) console.log(`  ${C.yellow}DRY RUN — no Bedrock calls${C.reset}`)

  header('SCENARIO', C.yellow)
  prompt.split('\n').forEach(l => console.log(`  ${l}`))

  if (dryRun) {
    console.log(`\n${C.yellow}[DRY RUN] Would fire ${agentNames.length} FSMs × ${PHASES.length} phases = ${agentNames.length * PHASES.length} Bedrock calls in parallel.${C.reset}`)
    process.exit(0)
  }

  // ── Phase event collector (thread-safe: each agent appends to its own array) ─

  const phaseEvents = {}
  agentNames.forEach(n => { phaseEvents[n] = [] })

  const onPhase = (agent, phase, output, ms) => {
    phaseEvents[agent].push({ phase, output, ms })
    process.stdout.write(`  ${C.dim}[${agent.toUpperCase()}:${phase}]${C.reset} ${C.dim}${ms}ms ✓${C.reset}\n`)
  }

  // ── Launch all FSMs in parallel ────────────────────────────────────────────

  header(`LAUNCHING ${agentNames.length} AGENTS IN PARALLEL`, C.magenta)
  console.log()

  const wallStart = Date.now()

  const tasks = agentNames.map(name => {
    const fsm = makeLivefsm(name, onPhase)
    return fsm.run(prompt).then(r => ({ ...r, agent: name })).catch(err => ({
      agent:   name,
      error:   err.message,
      phases:  {},
      report:  null,
      total_ms: Date.now() - wallStart,
    }))
  })

  const results = await Promise.all(tasks)
  const wallMs  = Date.now() - wallStart

  // ── Display full phase traces per agent ────────────────────────────────────

  header('REASONING CHAINS', C.cyan)

  for (const result of results) {
    if (result.error) {
      console.log(`\n${C.red}✗ ${result.agent.toUpperCase()} FAILED: ${result.error}${C.reset}`)
      continue
    }

    console.log(`\n${C.cyan}${'─'.repeat(70)}${C.reset}`)
    console.log(`${C.bold}${C.cyan}  ${result.agent.toUpperCase()}${C.reset}  ${C.dim}${result.model}${C.reset}`)

    for (const phase of PHASES) {
      const ev = phaseEvents[result.agent]?.find(e => e.phase === phase)
      if (ev) phaseBlock(result.agent, phase, ev.output, ev.ms)
    }
  }

  // ── Reports only (for quick read) ─────────────────────────────────────────

  header('FINAL REPORTS', C.green)

  const passed  = results.filter(r => !r.error)
  const failed  = results.filter(r => r.error)

  for (const result of passed) {
    console.log(`\n${C.bold}${C.cyan}[${result.agent.toUpperCase()}]${C.reset}  ${C.dim}${(result.total_ms / 1000).toFixed(1)}s${C.reset}`)
    result.report?.trim().split('\n').forEach(l => console.log(`  ${l}`))
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  header('PARALLEL FSM SUMMARY', C.magenta)
  console.log()
  console.log(`  Wall-clock time: ${C.bold}${(wallMs / 1000).toFixed(1)}s${C.reset}  (all ${agentNames.length} agents in parallel)`)
  console.log(`  Sequential time would be: ~${(results.reduce((s, r) => s + (r.total_ms ?? 0), 0) / 1000).toFixed(1)}s`)
  console.log()

  if (passed.length) {
    console.log(`${C.green}  ✓ PASSED (${passed.length}):${C.reset}`)
    passed.forEach(r => {
      const phases = PHASES.filter(p => r.phases[p]).length
      console.log(`    ${r.agent.padEnd(10)} ${phases}/6 phases  ${(r.total_ms / 1000).toFixed(1)}s  ${C.dim}run:${r.run_id}${C.reset}`)
    })
  }

  if (failed.length) {
    console.log(`\n${C.red}  ✗ FAILED (${failed.length}):${C.reset}`)
    failed.forEach(r => console.log(`    ${r.agent}  ${C.dim}${r.error}${C.reset}`))
  }

  console.log(`\n${C.dim}  WORM log: ${join(__dir, '.sovereign-fsm-worm.jsonl')}${C.reset}`)
  console.log(`${C.magenta}${'═'.repeat(70)}${C.reset}\n`)

  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(`${C.red}FATAL: ${err.message}${C.reset}`)
  console.error(err.stack)
  process.exit(1)
})
