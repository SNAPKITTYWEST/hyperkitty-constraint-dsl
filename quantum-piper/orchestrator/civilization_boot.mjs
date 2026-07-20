/**
 * civilization_boot.mjs — Sovereign Quantum Civilization Entry Point
 *
 * Wires: METATRON cage check + MAGMA routing + omega vortex agents + quantum swarm
 * into a single boot + dispatch + loop pipeline.
 *
 * Usage:
 *   node civilization_boot.mjs --boot
 *   node civilization_boot.mjs --mission="analyze treasury"
 *   node civilization_boot.mjs --loop="audit vault|forge proof|seal record"
 */

import { createHash } from 'crypto'
import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── WORM helpers ──────────────────────────────────────────────────────────────

let _prevCivSeal = '0'.repeat(64)

function civSeal (entry) {
  const { seal: _s, ...rest } = entry
  const raw = JSON.stringify({ ...rest, prev: _prevCivSeal })
  const seal = createHash('sha256').update(raw).digest('hex')
  _prevCivSeal = seal
  return seal
}

function appendCivWorm (file, entry) {
  const sealed = { ...entry, seal: civSeal(entry) }
  appendFileSync(file, JSON.stringify(sealed) + '\n')
  return sealed
}

// ── MAGMA routing (JS port of bob.rs heuristics) ──────────────────────────────

const MAGMA_ROUTES = [
  { key: 'has_seal',      keywords: ['seal', 'sign', 'attest', 'worm'],     route: 'CIPHER/SIGN'        },
  { key: 'has_vault',     keywords: ['vault', 'approve', 'treasury', 'fund'], route: 'VAULT/APPROVE'    },
  { key: 'has_rupture',   keywords: ['monitor', 'alert', 'threat', 'audit'], route: 'SENTINEL/MONITOR'  },
  { key: 'has_forge',     keywords: ['build', 'compile', 'forge', 'code'],   route: 'FORGE/BUILD'       },
  { key: 'has_resonance', keywords: ['oracle', 'knowledge', 'search', 'find'], route: 'ORACLE/KNOWLEDGE'},
  { key: 'has_memory',    keywords: ['memory', 'worm', 'ledger', 'record'],  route: 'HERALD/BROADCAST'  },
]

function magmaRoute (mission) {
  const m = mission.toLowerCase()
  for (const r of MAGMA_ROUTES) {
    if (r.keywords.some(k => m.includes(k))) return r.route
  }
  return 'NOVA/SYNTHETIC'
}

// ── Boot ──────────────────────────────────────────────────────────────────────

export async function bootCivilization (opts = {}) {
  const wormFile = opts.wormFile || join(__dir, '.civilization-worm.jsonl')

  // 1. METATRON cage check (soft gate — warns but does not block boot)
  let metatronStatus = 'unchecked'
  let metatronRecognition = ''
  try {
    const { resurrect, readCubeBackward } = await import('./metatron/metatron.mjs')
    const wormChain = existsSync(wormFile)
      ? readFileSync(wormFile, 'utf-8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
      : []
    const backward = readCubeBackward(wormChain)
    metatronRecognition = resurrect({ backward })
    metatronStatus = backward.cageIntact ? 'intact' : 'degraded'
  } catch (e) {
    metatronStatus = `error: ${e.message}`
  }

  // 2. Load omega civilization agents
  const agentsPath = join(__dir, 'omega', 'agents.json')
  let agents = []
  try {
    const raw = JSON.parse(readFileSync(agentsPath, 'utf-8'))
    agents = Array.isArray(raw) ? raw : (raw.agents || Object.values(raw))
  } catch (e) {
    console.warn('[BOOT] agents.json not loaded:', e.message)
  }

  // 3. Init quantum swarm
  const { QuantumSwarmCoordinator, SWARM_PRESETS } = await import('../swarm/swarm_coordinator.mjs')
  const swarmAgents = SWARM_PRESETS['quantum-full']
  const coordinator = new QuantumSwarmCoordinator({ agents: swarmAgents, wormFile })
  await coordinator.init()

  // 4. Optionally start omega WebSocket server
  if (opts.startServer) {
    try {
      await import('./omega/server.example.mjs')
      console.log('[BOOT] Omega WebSocket server started on ws://localhost:8787')
    } catch (e) {
      console.warn('[BOOT] Omega server not started:', e.message)
    }
  }

  // 5. Genesis WORM entry
  if (!existsSync(wormFile)) {
    const genesis = {
      ts: new Date().toISOString(), event: 'CIVILIZATION_BOOT',
      agents: agents.length, swarm_preset: 'quantum-full',
      metatron_status: metatronStatus, prev: '0'.repeat(64), seal: ''
    }
    genesis.seal = civSeal(genesis)
    writeFileSync(wormFile, JSON.stringify(genesis) + '\n')
  }

  // 6. Boot manifest
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  SOVEREIGN QUANTUM CIVILIZATION — BOOT MANIFEST      ║')
  console.log('╠══════════════════════════════════════════════════════╣')
  console.log(`║  Omega agents:   ${String(agents.length).padEnd(34)}║`)
  console.log(`║  Swarm preset:   quantum-full (${String(swarmAgents.length)} agents)`.padEnd(54) + '║')
  console.log(`║  METATRON cage:  ${metatronStatus.padEnd(34)}║`)
  console.log(`║  WORM file:      ${wormFile.slice(-34).padEnd(34)}║`)
  console.log('╚══════════════════════════════════════════════════════╝')
  if (metatronRecognition) console.log('\n[METATRON]', metatronRecognition.slice(0, 120))

  return { metatronStatus, metatronRecognition, coordinator, agents, wormFile }
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export async function dispatchMission (civilization, mission, opts = {}) {
  const { coordinator, wormFile } = civilization

  // 1. MAGMA route
  const route = magmaRoute(mission)

  // 2. METATRON gate (soft — logs, does not block)
  let gateResult = { passed: true }
  try {
    const { metatronGate } = await import('./metatron/metatron.mjs')
    gateResult = await metatronGate(route, mission, null, 1.0, null)
  } catch (e) {
    gateResult = { passed: true, warning: e.message }
  }

  // 3. Quantum swarm tick
  const consensus = await coordinator.tick(mission)

  // 4. Seal to civilization WORM
  const entry = {
    ts: new Date().toISOString(), event: 'MISSION_DISPATCH',
    mission: mission.slice(0, 120), route, metatron_gate: gateResult.passed,
    consensus_action: consensus.consensus_action,
    consensus_seal: consensus.consensus_seal,
    tick_id: consensus.tick_id,
    quantum_seeds: consensus.quantum_seeds?.slice(0, 3),
    prev: '', seal: ''
  }
  const sealed = appendCivWorm(wormFile, entry)

  console.log(`[DISPATCH] route=${route} consensus=${consensus.consensus_action} seal=${sealed.seal.slice(0,16)}...`)
  return { agent: route, route, consensus, seal: sealed.seal, gateResult }
}

// ── Loop ──────────────────────────────────────────────────────────────────────

export async function runCivLoop (civilization, missions, opts = {}) {
  const results = []
  for (const mission of missions) {
    const result = await dispatchMission(civilization, mission, opts)
    results.push(result)
  }
  const tail = civilization.coordinator.getWormTail(10)
  return { results, worm_tail: tail, total: results.length }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args    = process.argv.slice(2)
  const get     = k => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=')
  const hasFlag = k => args.includes(`--${k}`)

  const civ = await bootCivilization({ startServer: hasFlag('server') })

  if (hasFlag('boot')) {
    // manifest already printed in bootCivilization
    process.exit(0)
  }

  const mission = get('mission')
  if (mission) {
    const result = await dispatchMission(civ, mission)
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  }

  const loop = get('loop')
  if (loop) {
    const missions = loop.split('|').map(m => m.trim()).filter(Boolean)
    const result = await runCivLoop(civ, missions)
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  }

  console.log('Usage: node civilization_boot.mjs [--boot] [--mission="text"] [--loop="m1|m2|m3"] [--server]')
}
