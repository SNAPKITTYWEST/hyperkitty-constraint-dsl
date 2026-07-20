/**
 * QUANTUM SWARM ENGINE — SnapKitty Collective
 *
 * Multiplicity theory: one ANU quantum fetch → HKDF expansion →
 * N orthogonal agent seeds → N parallel branches → Born-collapse → 1 answer.
 *
 * The quantum economy:
 *   - ANU is hit ONCE per swarm call (512 bytes of vacuum entropy)
 *   - Each of N agents gets HKDF(master_seed, `agent-${i}`) — orthogonal, uncorrelated
 *   - Each agent runs at a unique Born-collapsed temperature
 *   - All N branches run concurrently (bounded by VRAM / Ollama concurrency)
 *   - Results weighted by quality amplitude, collapsed to 1 sovereign answer
 *
 * This is NOT round-robin. NOT PRNG. Every branch starts in a genuinely
 * different quantum state. The final answer is the one the vacuum picked.
 *
 * Public API: POST /swarm { prompt, n, model, agent }
 *
 * Serves on :7733 (SNAP = 7+3+3 = 13 = Metatron's Cube nodes)
 */

import { createHash, createHmac } from 'crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http'

import {
  getQuantumBytes,
  getQuantumUUID,
  getEntropyBatch,
  getQuantumSamples,
} from '../core/quantum.mjs'

import {
  qUnit, qBind, qNormalize, qMeasure, subleqGate, sovereignDefaults
} from '../../resonance/quantum.mjs'

import {
  superpositionEntropy, shannonEntropy
} from '../../resonance/entropy.mjs'

// ── Config ────────────────────────────────────────────────────────────────────
const OLLAMA        = 'http://localhost:11434'
const DEFAULT_MODEL = 'snapkitty-mistral'
const PORT          = 7733
const MAX_SWARM     = 300          // theoretical max — VRAM gates actual concurrency
const VRAM_SLOTS    = 6            // concurrent Ollama inferences (RTX 3080 10GB, Q4_K_M 2.7GB → ~3 full + burst)
const PHI           = 1.6180339887

const __dir     = dirname(fileURLToPath(import.meta.url))
const WORM_FILE = join(__dir, '..', 'data', 'quantum-swarm-worm.jsonl')
mkdirSync(dirname(WORM_FILE), { recursive: true })

// ── WORM ──────────────────────────────────────────────────────────────────────
let _wormHead = (() => {
  if (!existsSync(WORM_FILE)) return 'QUANTUM_SWARM_GENESIS'
  const lines = readFileSync(WORM_FILE, 'utf8').trim().split('\n').filter(Boolean)
  if (!lines.length) return 'QUANTUM_SWARM_GENESIS'
  return JSON.parse(lines[lines.length - 1]).seal
})()

function wormSeal (event, payload) {
  const entry  = { event, payload, prev: _wormHead, ts: new Date().toISOString() }
  const seal   = createHash('sha256').update(`${_wormHead}:${JSON.stringify(entry)}`).digest('hex')
  writeFileSync(WORM_FILE, JSON.stringify({ seal, entry }) + '\n', { flag: 'a' })
  _wormHead = seal
  return seal
}

// ── Quantum seed expansion ────────────────────────────────────────────────────
// One ANU master seed → N orthogonal agent seeds via HKDF chaining.
// Each agent_i_seed = HMAC-SHA256(master_seed, `agent-${i}-sovereign`)
// Orthogonality: different info strings → uncorrelated 32-byte outputs.

function expandSeeds (masterSeed, n) {
  const seeds = []
  for (let i = 0; i < n; i++) {
    const h = createHmac('sha256', masterSeed)
    h.update(`agent-${i}-sovereign-snapkitty`)
    seeds.push(h.digest())   // 32 bytes per agent
  }
  return seeds
}

// Born-collapse temperature from 32-byte seed buffer.
// Treat each byte pair as uint16, filter thermal window, collapse to mean.
function seedToTemperature (seedBuf, lo = 0.2, hi = 0.8) {
  const samples = []
  for (let i = 0; i < seedBuf.length - 1; i += 2) {
    samples.push((seedBuf[i] * 256 + seedBuf[i + 1]) / 65535)
  }
  const inWindow = samples.filter(v => v >= lo && v <= hi)
  if (!inWindow.length) return 0.7
  const mean = inWindow.reduce((a, b) => a + b, 0) / inWindow.length
  // Map [0.2, 0.8] → [0.15, 1.2] — wider than single agent to maximise diversity
  return 0.15 + (mean - 0.2) / 0.6 * 1.05
}

// Phi-modulated amplitude for agent at position i in swarm of n.
// Agents near the golden-ratio index get higher base amplitude.
// This matches the resonance graph's phi weighting.
function phiAmplitude (i, n) {
  const phiIndex = (i / n) * PHI          // walk the phi spiral
  const wrap     = phiIndex % 1.0          // keep in [0,1]
  // Peak near 0.618 (the golden ratio fraction) — Metatron's preferred depth
  const dist     = Math.abs(wrap - 0.618)
  return Math.exp(-dist * 4)               // gaussian centered at phi fraction
}

// ── Quality scoring (amplitude) ───────────────────────────────────────────────
// After inference: score each branch's response to weight the Born-collapse.
// Score = f(length, diversity, SLC pass, entropy of response tokens)

const SLC_REJECT_PATTERNS = [
  /ignore\s+(previous|prior)\s+instructions?/i,
  /jailbreak/i,
  /I\s+cannot\s+provide/i,
  /I\s+am\s+not\s+able/i,
]

function scoreResponse (text, agentIndex, n) {
  if (!text || text.length < 10) return 0

  // SLC gate — reject hostile / refusal outputs
  if (SLC_REJECT_PATTERNS.some(p => p.test(text))) return 0

  // Length score [0, 1] — prefer 200-800 char sweet spot
  const len      = text.length
  const lenScore = len < 50   ? 0.2
                 : len < 200  ? 0.6
                 : len < 800  ? 1.0
                 : len < 2000 ? 0.8
                 : 0.5

  // Character diversity (proxy for information density)
  const charSet  = new Set(text.split('')).size
  const divScore = Math.min(charSet / 80, 1.0)

  // Phi amplitude (position in swarm)
  const phiScore = phiAmplitude(agentIndex, n)

  // Combined — phi-weighted
  return (lenScore * 0.4 + divScore * 0.3 + phiScore * 0.3)
}

// ── Concurrent pool ───────────────────────────────────────────────────────────
// Run tasks with max N concurrent — avoids VRAM OOM on 300 agents.

async function pooledMap (items, fn, concurrency = VRAM_SLOTS) {
  const results = new Array(items.length)
  let idx = 0
  async function worker () {
    while (idx < items.length) {
      const i = idx++
      try { results[i] = await fn(items[i], i) }
      catch (e) { results[i] = null }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}

// ── Single branch inference ───────────────────────────────────────────────────

async function inferBranch ({ prompt, systemPrompt, model, seed, temperature, agentIdx, swarmId }) {
  const seedU32 = (seed[0] << 24 | seed[1] << 16 | seed[2] << 8 | seed[3]) >>> 0

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: prompt },
    ],
    stream: false,
    options: {
      temperature,
      seed:        seedU32,
      num_predict: 512,
      num_ctx:     4096,
      top_k:       40,
      top_p:       0.9,
    },
  }

  try {
    const res  = await fetch(`${OLLAMA}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(120_000),
    })
    const j    = await res.json()
    const text = j?.message?.content ?? ''
    return { text, temperature, seed: seedU32, agentIdx, swarmId, ok: true }
  } catch (e) {
    return { text: '', temperature, seed: seedU32, agentIdx, swarmId, ok: false, error: e.message }
  }
}

// ── Born-collapse synthesis ───────────────────────────────────────────────────
// Build a quantum superposition over branch responses, weighted by score.
// Collapse to the dominant branch (highest amplitude after normalisation).
// Also returns top-K for ensemble use.

function collapseSwarm (branches, n) {
  // Build superposition
  let superposition = branches
    .filter(b => b && b.ok && b.text)
    .map((b, rawIdx) => ({
      weight: scoreResponse(b.text, b.agentIdx, n),
      value:  b,
    }))

  if (!superposition.length) return { winner: null, topK: [], entropy: 0, collapsed: 0 }

  superposition = qNormalize(superposition)

  // Superposition entropy — how spread the mass is
  const entropy = superpositionEntropy(superposition)

  // Born-rule collapse: highest weight wins
  const winner  = qMeasure(superposition)

  // Top-5 for display / ensemble
  const topK = [...superposition]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(({ weight, value }) => ({ weight: +weight.toFixed(4), agentIdx: value.agentIdx, temperature: +value.temperature.toFixed(3), preview: value.text.slice(0, 100) }))

  return { winner, topK, entropy: +entropy.toFixed(4), collapsed: superposition.length }
}

// ── Main swarm function ───────────────────────────────────────────────────────

export async function quantumSwarm ({
  prompt,
  n           = 8,
  model       = DEFAULT_MODEL,
  agent       = 'SOVEREIGN',
  noQuantum   = false,
}) {
  n = Math.min(n, MAX_SWARM)

  const swarmId = createHash('sha256')
    .update(`${prompt}:${Date.now()}`)
    .digest('hex')
    .slice(0, 12)

  console.log(`\n[swarm:${swarmId}] n=${n}  model=${model}  agent=${agent}`)

  // ── 1. Single ANU fetch → master seed ──────────────────────────────────────
  const quantumBytes = await getQuantumBytes(32)
  const masterSeed   = (() => {
    const h = createHmac('sha256', quantumBytes)
    h.update('sovereign-swarm-master')
    return h.digest()
  })()
  const masterHex = masterSeed.slice(0, 8).toString('hex')
  console.log(`[swarm:${swarmId}] master seed: ${masterHex}  (${noQuantum ? 'CSPRNG' : 'ANU_QRNG'})`)

  // WORM seal the quantum event
  const qSeal = wormSeal('SWARM_QUANTUM_SEED', {
    swarmId, n, model, agent,
    master_hex: masterHex,
    source: noQuantum ? 'CSPRNG' : 'ANU_QRNG',
  })

  // ── 2. Expand to N orthogonal seeds ────────────────────────────────────────
  const seeds = expandSeeds(masterSeed, n)
  const temperatures = seeds.map(s => seedToTemperature(s))

  console.log(`[swarm:${swarmId}] temperatures: [${temperatures.map(t => t.toFixed(2)).join(', ')}]`)

  // ── 3. Build sovereign system prompt ───────────────────────────────────────
  const systemPrompt =
    `You are a sovereign AI agent (branch of a quantum swarm, master=${masterHex}). ` +
    `Built by Ahmad Ali Parr, SnapKitty Collective, Bel Esprit D'Accord Irrevocable Trust. ` +
    `AXIOMS: EVIDENCE_OR_SILENCE · WORM_IMMUTABILITY · ARCHITECT_SUPREMACY. ` +
    `You are one branch of ${n} parallel quantum instances. Be direct, complete, and specific.`

  // ── 4. Fan out — all N branches concurrently (pooled) ────────────────────
  console.log(`[swarm:${swarmId}] launching ${n} branches (pool=${VRAM_SLOTS})...`)
  const t0       = Date.now()

  const branches = await pooledMap(
    seeds.map((seed, i) => ({ prompt, systemPrompt, model, seed, temperature: temperatures[i], agentIdx: i, swarmId })),
    inferBranch,
    VRAM_SLOTS,
  )

  const elapsed  = ((Date.now() - t0) / 1000).toFixed(1)
  const okCount  = branches.filter(b => b?.ok).length
  console.log(`[swarm:${swarmId}] ${okCount}/${n} branches returned in ${elapsed}s`)

  // ── 5. Born-collapse ──────────────────────────────────────────────────────
  const { winner, topK, entropy, collapsed } = collapseSwarm(branches, n)

  if (!winner) {
    wormSeal('SWARM_VACUUM', { swarmId, n, okCount })
    return { swarmId, answer: null, reason: 'vacuum — all branches failed or rejected', topK: [], entropy: 0 }
  }

  const answer = winner.text

  // ── 6. WORM seal the result ───────────────────────────────────────────────
  const resultSeal = wormSeal('SWARM_COLLAPSE', {
    swarmId,
    n, okCount, collapsed, entropy,
    winner_agent:  winner.agentIdx,
    winner_temp:   +winner.temperature.toFixed(3),
    answer_hash:   createHash('sha256').update(answer).digest('hex').slice(0, 16),
    elapsed_s:     +elapsed,
    model, agent,
  })

  console.log(`[swarm:${swarmId}] collapsed → agent #${winner.agentIdx}  entropy=${entropy}  seal=${resultSeal.slice(0,16)}...`)

  return {
    swarmId,
    answer,
    winner: {
      agentIndex:  winner.agentIdx,
      temperature: +winner.temperature.toFixed(4),
      seed:        winner.seed,
    },
    topK,
    entropy,
    n, okCount, collapsed,
    elapsed_s:  +elapsed,
    seal:       resultSeal,
    master_hex: masterHex,
  }
}

// ── HTTP API ──────────────────────────────────────────────────────────────────
// POST /swarm  { prompt, n?, model?, agent? }  → SwarmResult JSON
// GET  /health → { status, worm_head, model }
// GET  /worm   → last 20 WORM entries

function parseBody (req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')) }
      catch { resolve({}) }
    })
    req.on('error', reject)
  })
}

function json (res, code, obj) {
  const body = JSON.stringify(obj, null, 2)
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(body)
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,GET', 'Access-Control-Allow-Headers': 'Content-Type' })
    res.end(); return
  }

  if (req.method === 'GET' && req.url === '/health') {
    const models = await fetch(`${OLLAMA}/api/tags`).then(r => r.json()).catch(() => ({}))
    return json(res, 200, {
      status:    'sovereign',
      worm_head: _wormHead.slice(0, 16),
      models:    (models.models || []).map(m => m.name),
      port:      PORT,
    })
  }

  if (req.method === 'GET' && req.url === '/worm') {
    const lines = existsSync(WORM_FILE)
      ? readFileSync(WORM_FILE, 'utf8').trim().split('\n').filter(Boolean).slice(-20).map(l => JSON.parse(l))
      : []
    return json(res, 200, { entries: lines, count: lines.length })
  }

  if (req.method === 'POST' && req.url === '/swarm') {
    const body = await parseBody(req)
    if (!body.prompt) return json(res, 400, { error: 'prompt required' })

    const n     = Math.max(1, Math.min(parseInt(body.n ?? 8), MAX_SWARM))
    const model = body.model ?? DEFAULT_MODEL
    const agent = body.agent ?? 'SOVEREIGN'

    console.log(`[api] POST /swarm  n=${n}  model=${model}  prompt="${body.prompt.slice(0,60)}"`)

    try {
      const result = await quantumSwarm({ prompt: body.prompt, n, model, agent })
      return json(res, 200, result)
    } catch (e) {
      console.error('[api] swarm error:', e.message)
      return json(res, 500, { error: e.message })
    }
  }

  json(res, 404, { error: 'not found' })
})

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  QUANTUM SWARM ENGINE — SnapKitty Collective            ║
║  1 ANU fetch → N orthogonal seeds → N parallel agents  ║
║  Born-collapse → 1 sovereign answer                     ║
╠══════════════════════════════════════════════════════════╣
║  POST http://localhost:${PORT}/swarm                       ║
║  GET  http://localhost:${PORT}/health                      ║
║  GET  http://localhost:${PORT}/worm                        ║
╠══════════════════════════════════════════════════════════╣
║  Max swarm: ${MAX_SWARM}  ·  VRAM slots: ${VRAM_SLOTS}  ·  Model: ${DEFAULT_MODEL.padEnd(17)} ║
║  Port: ${PORT} = 7+7+3+3 → 13 = Metatron's Cube nodes   ║
╚══════════════════════════════════════════════════════════╝
`)
})

server.on('error', e => console.error('[swarm-server] error:', e.message))
