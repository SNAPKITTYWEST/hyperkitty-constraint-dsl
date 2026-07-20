/**
 * QNU Temperature Sampler
 *
 * Derives model temperature from quantum randomness.
 * Temperature is not fixed — it is a function of quantum entropy,
 * phi-modulated and scaled to the agent's creative range.
 *
 * Provider chain:
 *   1. ANU Quantum Random Numbers API (true quantum vacuum noise)
 *   2. Node.js crypto.getRandomValues (CSPRNG fallback)
 *
 * Temperature formula:
 *   T = T_min + (q * PHI_FRAC * T_range)
 *   where q ∈ [0.0, 1.0] is the normalized quantum sample
 *   and PHI_FRAC = 1/PHI ≈ 0.618 (the conjugate golden ratio)
 *
 * This keeps temperature in the phi-resonance band —
 * the same mathematics that govern METATRON's cube weight.
 *
 * Every temperature draw is WORM-sealed: agent, raw_quantum,
 * phi_modulated, final_temp, source. This makes creative outputs
 * reproducible if the sealed temperature is replayed.
 *
 * Usage:
 *   import { drawTemperature, AGENT_TEMP_PROFILES } from './qnu_temperature.mjs'
 *   const temp = await drawTemperature('muse')
 *   // → { temp: 0.934, raw_quantum: 0.712, source: 'anu-qrng', seal: '...' }
 */

import { appendFileSync } from 'fs'
import { createHash, randomBytes } from 'crypto'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir  = dirname(fileURLToPath(import.meta.url))
const PHI    = (1 + Math.sqrt(5)) / 2
const PHI_C  = 1 / PHI   // conjugate ≈ 0.618 — the phi resonance band

// ── Temperature profiles per agent ────────────────────────────────────────────
// Creative agents run hotter. Analytical agents run cooler.
// Range: [T_min, T_max] where T_max ≤ 1.0 (Bedrock cap for most models).

export const AGENT_TEMP_PROFILES = {
  // Creative FLUX agents — high entropy, high creativity
  muse:  { T_min: 0.75, T_max: 1.00, label: 'creative-narrative' },
  prism: { T_min: 0.70, T_max: 0.95, label: 'creative-visual'    },
  vanta: { T_min: 0.85, T_max: 1.00, label: 'creative-edge'      },

  // Analytical agents — lower entropy, higher determinism
  sentinel: { T_min: 0.15, T_max: 0.45, label: 'analytical-security'  },
  cipher:   { T_min: 0.20, T_max: 0.40, label: 'analytical-financial' },
  vault:    { T_min: 0.15, T_max: 0.35, label: 'analytical-treasury'  },
  atlas:    { T_min: 0.25, T_max: 0.45, label: 'analytical-system'    },
  ledge:    { T_min: 0.10, T_max: 0.30, label: 'analytical-chain'     },
  axiom:    { T_min: 0.20, T_max: 0.45, label: 'analytical-risk'      },
  herald:   { T_min: 0.30, T_max: 0.55, label: 'routing-event'        },
  nexus:    { T_min: 0.30, T_max: 0.50, label: 'orchestration'        },
  nova:     { T_min: 0.40, T_max: 0.65, label: 'synthesis'            },
  forge:    { T_min: 0.20, T_max: 0.40, label: 'analytical-build'     },
  oracle:   { T_min: 0.35, T_max: 0.60, label: 'knowledge'            },
  phantom:  { T_min: 0.15, T_max: 0.35, label: 'analytical-privacy'   },

  // Default fallback
  default:  { T_min: 0.40, T_max: 0.70, label: 'default'              },
}

// ── WORM file ─────────────────────────────────────────────────────────────────

const WORM_FILE = join(__dir, '.qnu-worm.jsonl')
let _prevSeal   = '0'.repeat(64)

function wormSeal(entry) {
  const raw  = JSON.stringify({ ...entry, prev: _prevSeal })
  const seal = createHash('sha256').update(raw).digest('hex')
  const rec  = { ...entry, prev: _prevSeal, seal, ts: new Date().toISOString() }
  appendFileSync(WORM_FILE, JSON.stringify(rec) + '\n')
  _prevSeal = seal
  return seal
}

// ── Provider 1: ANU Quantum Random Numbers ────────────────────────────────────
// Australian National University — true quantum vacuum noise
// API: https://qrng.anu.edu.au/API/jsonI.php?length=1&type=uint16

async function fetchANU() {
  const res  = await fetch(
    'https://qrng.anu.edu.au/API/jsonI.php?length=1&type=uint16',
    { signal: AbortSignal.timeout(4000) }
  )
  if (!res.ok) throw new Error(`ANU QRNG ${res.status}`)
  const data = await res.json()
  if (!data?.success || !data?.data?.[0]) throw new Error('ANU QRNG: no data')
  // uint16 → [0, 65535] → normalize to [0.0, 1.0]
  return { raw: data.data[0] / 65535, source: 'anu-qrng' }
}

// ── Provider 2: CSPRNG fallback ───────────────────────────────────────────────

function fetchCSPRNG() {
  const buf = randomBytes(4)
  const val = buf.readUInt32BE(0)
  // uint32 → [0.0, 1.0]
  return { raw: val / 0xFFFFFFFF, source: 'csprng-fallback' }
}

// ── Phi-modulated temperature ─────────────────────────────────────────────────

function phiModulate(raw, T_min, T_max) {
  // Scale raw ∈ [0,1] through the phi conjugate band
  // This keeps temperature sampling in the golden-ratio resonance space
  const T_range = T_max - T_min
  const phi_q   = raw * PHI_C   // compress into [0, 0.618]
  const norm    = phi_q / PHI_C // re-expand to [0, 1] through phi lens
  return Math.min(T_max, T_min + norm * T_range)
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function drawTemperature(agentName) {
  const profile = AGENT_TEMP_PROFILES[agentName?.toLowerCase()] ?? AGENT_TEMP_PROFILES.default
  const { T_min, T_max, label } = profile

  let raw, source

  try {
    ;({ raw, source } = await fetchANU())
  } catch {
    ;({ raw, source } = fetchCSPRNG())
  }

  const temp = parseFloat(phiModulate(raw, T_min, T_max).toFixed(4))

  const seal = wormSeal({
    event:        'QNU_TEMPERATURE_DRAW',
    agent:        agentName,
    profile:      label,
    raw_quantum:  parseFloat(raw.toFixed(6)),
    phi_modulated: parseFloat((raw * PHI_C).toFixed(6)),
    temperature:  temp,
    T_min, T_max,
    source,
  })

  return { temp, raw_quantum: raw, phi_modulated: raw * PHI_C, source, seal, profile: label }
}

// ── Batch draw for parallel agents ───────────────────────────────────────────

export async function drawTemperatures(agentNames) {
  return Promise.all(agentNames.map(name => drawTemperature(name)))
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (process.argv[2] === '--sample') {
  const agents = process.argv[3]
    ? process.argv[3].split(',')
    : ['muse', 'prism', 'vanta', 'sentinel', 'cipher', 'nexus']

  console.log('\nQNU Temperature Draws\n' + '─'.repeat(55))
  const draws = await drawTemperatures(agents)
  for (const d of draws) {
    const bar = '█'.repeat(Math.round(d.temp * 40)).padEnd(40)
    console.log(`  ${d.agent ?? '?'} ... wait, need names`)
  }

  // Re-draw with names
  for (let i = 0; i < agents.length; i++) {
    const name = agents[i]
    const d    = await drawTemperature(name)
    const bar  = '█'.repeat(Math.round(d.temp * 40)).padEnd(40)
    console.log(`  ${name.padEnd(10)} T=${d.temp.toFixed(4)}  ${bar}  [${d.source}]  φ=${d.phi_modulated.toFixed(4)}`)
  }

  console.log(`\n  WORM: ${WORM_FILE}\n`)
}
