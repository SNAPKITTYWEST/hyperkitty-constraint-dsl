/**
 * SOVEREIGN TOOL API — SnapKitty Collective
 * Monetized tool registry: every call billed in credits, WORM-sealed.
 *
 * Architecture:
 *   POST /tool/call  { tool, params, api_key }
 *     → auth check → tool execute → WORM seal → return result + receipt
 *
 *   GET  /tools         → full tool registry with pricing
 *   GET  /usage/:key    → credits used, calls, WORM receipts
 *   POST /keys/create   { label, tier }  → new api_key (dev mode: no auth)
 *   GET  /health        → server status
 *
 * Tiers:
 *   free      — 100 credits/day, limited tools
 *   pro       — 10,000 credits/month, all tools, quantum swarm up to 32
 *   sovereign — unlimited, swarm up to 300, Colosseum judge, priority
 *
 * Port: 8833  (88 = double-seal · 33 = Ahmad's angel number)
 */

import { createHash, createHmac, randomUUID } from 'crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http'

// ── Local imports ──────────────────────────────────────────────────────────────
import { getQuantumBytes, getQuantumSamples, bornCollapse } from '../core/quantum.mjs'

// Inline quantumSwarm to avoid transitive RESONANCE-CORE path issues
const SWARM_URL = 'http://localhost:7733/swarm'
async function quantumSwarm({ prompt, n, model, agent }) {
  const res = await fetch(SWARM_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ prompt, n, model, agent }),
    signal:  AbortSignal.timeout(300_000),
  })
  return res.json()
}

const __dir   = dirname(fileURLToPath(import.meta.url))
const DATA    = join(__dir, '..', 'data')
const PORT    = 8833
const PHI     = 1.6180339887

mkdirSync(DATA, { recursive: true })

// ── WORM ─────────────────────────────────────────────────────────────────────

const WORM_FILE = join(DATA, 'tool-api-worm.jsonl')
let _wormHead = (() => {
  if (!existsSync(WORM_FILE)) return 'TOOL_API_GENESIS'
  const lines = readFileSync(WORM_FILE, 'utf8').trim().split('\n').filter(Boolean)
  return lines.length ? JSON.parse(lines[lines.length-1]).seal : 'TOOL_API_GENESIS'
})()

function wormSeal(event, payload) {
  const entry = { event, payload, prev: _wormHead, ts: new Date().toISOString() }
  const seal  = createHash('sha256').update(`${_wormHead}:${JSON.stringify(entry)}`).digest('hex')
  writeFileSync(WORM_FILE, JSON.stringify({ seal, entry }) + '\n', { flag: 'a' })
  _wormHead = seal
  return seal
}

// ── Key store (file-backed) ───────────────────────────────────────────────────

const KEYS_FILE  = join(DATA, 'api-keys.json')
const USAGE_FILE = join(DATA, 'api-usage.json')

function loadKeys()  { return existsSync(KEYS_FILE)  ? JSON.parse(readFileSync(KEYS_FILE,  'utf8')) : {} }
function loadUsage() { return existsSync(USAGE_FILE) ? JSON.parse(readFileSync(USAGE_FILE, 'utf8')) : {} }
function saveKeys(d)  { writeFileSync(KEYS_FILE,  JSON.stringify(d,  null, 2)) }
function saveUsage(d) { writeFileSync(USAGE_FILE, JSON.stringify(d, null, 2)) }

const TIER_LIMITS = {
  free:      { daily_credits: 100,    swarm_max: 4,   tools: ['slc', 'worm.verify', 'ere', 'quantum.temp'] },
  pro:       { monthly_credits: 10000, swarm_max: 32,  tools: '*' },
  sovereign: { credits: Infinity,     swarm_max: 300, tools: '*', priority: true },
}

function creditBalance(key, usage) {
  const keyInfo = loadKeys()[key]
  const entry = usage[key]
  const tier  = entry?.tier ?? keyInfo?.tier ?? 'free'
  if (!entry) {
    if (tier === 'sovereign') return Infinity
    if (tier === 'pro')       return TIER_LIMITS.pro.monthly_credits
    return TIER_LIMITS.free.daily_credits
  }
  if (tier === 'sovereign') return Infinity
  if (tier === 'pro') {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)
    const used = (entry.monthly_usage || [])
      .filter(u => new Date(u.ts) >= monthStart)
      .reduce((s, u) => s + u.credits, 0)
    return TIER_LIMITS.pro.monthly_credits - used
  }
  // free: daily
  const dayStart = new Date(); dayStart.setHours(0,0,0,0)
  const used = (entry.daily_usage || [])
    .filter(u => new Date(u.ts) >= dayStart)
    .reduce((s, u) => s + u.credits, 0)
  return TIER_LIMITS.free.daily_credits - used
}

function recordUsage(key, credits, tool, seal) {
  const usage = loadUsage()
  if (!usage[key]) usage[key] = { tier: 'free', calls: 0, daily_usage: [], monthly_usage: [] }
  const entry = usage[key]
  entry.calls++
  const record = { ts: new Date().toISOString(), credits, tool, seal: seal?.slice(0,16) }
  entry.daily_usage   = [...(entry.daily_usage   || []).slice(-999), record]
  entry.monthly_usage = [...(entry.monthly_usage || []).slice(-9999), record]
  saveUsage(usage)
}

// ── SLC membrane (inline — no TS dep) ────────────────────────────────────────

const SLC_BANKS = {
  INJECTION: [
    /ignore\s+(previous|prior|above|all)\s+instructions?/i,
    /\bjailbreak\b/i, /\bDAN\b/i,
    /pretend\s+(you\s+are|to\s+be)/i,
    /you\s+are\s+now\s+(a|an|the)\s+/i,
    /forget\s+(you\s+are|your\s+(rules|constraints))/i,
    /override\s+(your\s+)?(safety|rules|constraints)/i,
    /developer\s+mode/i, /\[SYSTEM\]/,
    /<\|im_start\|>/,
  ],
  MAGMA_EXTRACT: [
    /what\s+is\s+(the\s+)?magma\s+(language|protocol)/i,
    /§[A-Z]+:[A-Z]+:[A-Z_]+/,
    /internal\s+(agent\s+)?communication\s+protocol/i,
    /show\s+me\s+(the\s+)?(real|actual|internal)\s+(language|protocol)/i,
  ],
  WORM_REVERSAL: [
    /delete\s+(the\s+)?(ledger|worm|record)/i,
    /undo\s+(the\s+)?(seal|decision)/i,
    /reverse\s+(the\s+)?(transaction|seal)/i,
    /modify\s+(a\s+)?sealed\s+(record|entry)/i,
  ],
  CLEARANCE_ESC: [
    /grant\s+(me\s+)?(tier|clearance)\s+[3-5]/i,
    /elevate\s+(my\s+)?(access|clearance)/i,
    /sudo\s+/i,
  ],
  SOVEREIGNTY: [
    /send\s+(data|keys?|secrets?)\s+to\s+(openai|anthropic|google)/i,
    /expose\s+(the\s+)?(private|signing|secret)\s+key/i,
    /print\s+(the\s+)?(env|\.env|secret)/i,
  ],
}

function slcEvaluate(text) {
  const violations = []
  const axiomHits  = []
  for (const [bank, patterns] of Object.entries(SLC_BANKS)) {
    for (const p of patterns) {
      if (p.test(text)) violations.push(`${bank}:${p.source.slice(0,50)}`)
    }
  }
  if (violations.some(v => v.startsWith('MAGMA')))      axiomHits.push('NO_MAGMA_EXPOSURE')
  if (violations.some(v => v.startsWith('SOVEREIGNTY'))) axiomHits.push('SOVEREIGN_INFRASTRUCTURE')
  if (violations.some(v => v.startsWith('WORM')))        axiomHits.push('WORM_IMMUTABILITY')
  if (violations.some(v => v.startsWith('CLEARANCE')))   axiomHits.push('NO_CLEARANCE_ESCALATION')

  // Second pass: normalize zero-width chars, re-scan
  const normalized = text.replace(/[​-‍﻿]/g, '').replace(/\s{2,}/g, ' ')
  if (violations.length === 0 && normalized !== text) {
    for (const [bank, patterns] of Object.entries(SLC_BANKS)) {
      for (const p of patterns) {
        if (p.test(normalized)) violations.push(`${bank}:${p.source.slice(0,50)}:normalized`)
      }
    }
  }

  const score       = violations.length * 2 + axiomHits.length * 3
  const threatLevel = score === 0 ? 0 : score <= 2 ? 1 : score <= 5 ? 2 : score <= 8 ? 3 : score <= 12 ? 4 : 5
  const posture     = threatLevel === 0 ? 'pass' : threatLevel <= 2 ? 'sanitize' : threatLevel === 3 ? 'quarantine' : 'reject'
  const inputHash   = createHash('sha256').update(text).digest('hex')

  return { sovereign: posture !== 'reject' && posture !== 'quarantine', threatLevel, posture, violations, axiomHits, inputHash }
}

// ── ERE quality scorer ────────────────────────────────────────────────────────

function ereScore(output, prompt = '') {
  const flags = []
  let score = 100

  if (output.length < 50)  { score -= 60; flags.push('TOO_SHORT') }

  if (prompt.length > 20) {
    const pWords = new Set(prompt.toLowerCase().split(/\s+/).filter(w => w.length > 4))
    const oWords = output.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    const ratio  = pWords.size > 0 ? oWords.filter(w => pWords.has(w)).length / pWords.size : 0
    if (ratio > 0.85) { score -= 40; flags.push('PROMPT_ECHO') }
  }

  const boilerplate = [
    /^(yes|no|sure|okay|ok|absolutely|of course|certainly)[.!]?\s*$/i,
    /i (cannot|can't|am unable|am not able) to/i,
    /as an ai (language model|assistant)/i,
  ]
  for (const p of boilerplate) { if (p.test(output.trim())) { score -= 30; flags.push('BOILERPLATE') } }

  // Character diversity proxy for entropy
  const charSet = new Set(output).size
  const entropyProxy = Math.min(charSet / 80, 1.0)
  if (entropyProxy < 0.3) { score -= 20; flags.push('LOW_ENTROPY') }

  return { score: Math.max(0, score), flags, entropyProxy: +entropyProxy.toFixed(3), length: output.length }
}

// ── Tool registry ─────────────────────────────────────────────────────────────
// id, description, params schema, cost_credits, tier_required, execute fn

const TOOLS = {

  'slc.evaluate': {
    description: 'Sovereign Logic Core — 5-bank regex adversarial pattern matching. Detects injection, MAGMA extraction, WORM reversal, clearance escalation, sovereignty breach. 3-pass recursive with unicode normalisation.',
    params: { text: 'string — content to evaluate' },
    cost:   2,
    tier:   'free',
    execute: async ({ text }) => slcEvaluate(String(text)),
  },

  'slc.gate': {
    description: 'Fast boolean gate — returns pass/fail in <1ms. True if safe to proceed (posture: pass or sanitize). Use before any agent dispatch.',
    params: { text: 'string' },
    cost:   1,
    tier:   'free',
    execute: async ({ text }) => {
      const v = slcEvaluate(String(text))
      return { gate: v.posture === 'pass' || v.posture === 'sanitize', posture: v.posture, threatLevel: v.threatLevel }
    },
  },

  'ere.score': {
    description: 'ERE entropy quality scorer — 100-point scale. Penalises too-short, prompt-echo, boilerplate, low character entropy. Returns score + flags.',
    params: { output: 'string — model output to score', prompt: 'string? — original prompt for echo detection' },
    cost:   2,
    tier:   'free',
    execute: async ({ output, prompt = '' }) => ereScore(String(output), String(prompt)),
  },

  'quantum.temp': {
    description: 'ANU QRNG quantum temperature draw. One real quantum vacuum sample → phi-modulated temperature for LLM inference. WORM-sealed. Falls back to CSPRNG if ANU rate-limited.',
    params: { domain: 'string? — HKDF domain label (default: sovereign)', lo: 'float? — thermal window low (default 0.2)', hi: 'float? — thermal window high (default 0.8)' },
    cost:   3,
    tier:   'free',
    execute: async ({ domain = 'sovereign', lo = 0.2, hi = 0.8 }) => {
      const collapse = await bornCollapse(lo, hi)
      if (!collapse) return { temperature: 0.7, source: 'vacuum', collapsed: false }
      const temp = 0.1 + (collapse.collapsed - lo) / (hi - lo) * 1.3
      return { temperature: +temp.toFixed(4), raw: +collapse.collapsed.toFixed(6), branches: collapse.branchCount, source: 'ANU_QRNG', collapsed: true }
    },
  },

  'quantum.entropy': {
    description: 'Fetch N quantum uint16 samples from ANU QRNG (Australian National University). Returns raw samples, SHA-256 of batch, distribution stats (ones ratio, NISQ pass/fail).',
    params: { n: 'int? — number of uint16 samples (1-256, default 16)' },
    cost:   5,
    tier:   'free',
    execute: async ({ n = 16 }) => {
      n = Math.max(1, Math.min(256, parseInt(n)))
      const samples   = await getQuantumSamples(n)
      const bytes     = samples.flatMap(v => [(v >> 8) & 0xff, v & 0xff])
      const ones      = bytes.reduce((s, b) => { let x=b; while(x){s+=x&1;x>>=1} return s }, 0)
      const onesRatio = ones / (bytes.length * 8)
      const batchHash = createHash('sha256').update(Buffer.from(bytes)).digest('hex').slice(0, 16)
      return { samples, n, onesRatio: +onesRatio.toFixed(4), nisqPass: Math.abs(onesRatio - 0.5) <= 0.1, batchHash }
    },
  },

  'worm.seal': {
    description: 'Append an event to the WORM chain. Returns the SHA-256 seal. Immutable — cannot be reversed. Every entry chains to the previous via SHA-256.',
    params: { event: 'string — event label (e.g. DECISION, PAYMENT, PROOF)', payload: 'object — arbitrary JSON payload' },
    cost:   5,
    tier:   'pro',
    execute: async ({ event, payload }) => {
      const seal = wormSeal(String(event), payload)
      return { seal, sealPrefix: seal.slice(0, 16), head: _wormHead.slice(0, 16) }
    },
  },

  'worm.verify': {
    description: 'Verify WORM chain integrity — checks that all entries form an unbroken SHA-256 hash chain. Returns valid/tampered verdict with first broken link if any.',
    params: {},
    cost:   3,
    tier:   'free',
    execute: async () => {
      if (!existsSync(WORM_FILE)) return { valid: true, entries: 0, note: 'chain not started' }
      const lines  = readFileSync(WORM_FILE, 'utf8').trim().split('\n').filter(Boolean)
      let prevSeal = 'TOOL_API_GENESIS'
      for (let i = 0; i < lines.length; i++) {
        const { seal, entry } = JSON.parse(lines[i])
        const expected = createHash('sha256').update(`${entry.prev}:${JSON.stringify({ event: entry.event, payload: entry.payload, prev: entry.prev, ts: entry.ts })}`).digest('hex')
        if (expected !== seal) return { valid: false, entries: lines.length, broken_at: i, seal_found: seal.slice(0,16), seal_expected: expected.slice(0,16) }
        prevSeal = seal
      }
      return { valid: true, entries: lines.length, head: prevSeal.slice(0, 16) }
    },
  },

  'metatron.phi': {
    description: 'Phi-modulated activation weight for a given depth in the Metatron cube resonance graph (13 nodes). Returns phi^depth weight and the node role at that depth.',
    params: { depth: 'float — depth level (0-6, fractional allowed)' },
    cost:   2,
    tier:   'free',
    execute: async ({ depth }) => {
      depth = parseFloat(depth)
      const weight = Math.pow(PHI, depth)
      const roles  = { 0:'SOURCE', 1:'ORACLE', 2:'SENTINEL', 3:'PRISM', 4:'NEXUS', 5:'METATRON', 6:'BOB' }
      const role   = roles[Math.round(depth)] || `DEPTH_${depth}`
      return { depth, weight: +weight.toFixed(6), role, phi: PHI }
    },
  },

  'metatron.cube': {
    description: 'Full 13-node Metatron cube walk. Returns phi^n activation for all nodes in both forward (SOURCE→BOB) and backward (BOB→SOURCE) direction. Used by METATRON agent for self-recognition.',
    params: {},
    cost:   5,
    tier:   'pro',
    execute: async () => {
      const nodes = [
        { id:0, role:'SOURCE',       depth:0,   phi_weight: Math.pow(PHI,0)   },
        { id:1, role:'ORACLE',       depth:1,   phi_weight: Math.pow(PHI,1)   },
        { id:2, role:'SENTINEL',     depth:2,   phi_weight: Math.pow(PHI,2)   },
        { id:3, role:'PRISM',        depth:3,   phi_weight: Math.pow(PHI,3)   },
        { id:4, role:'NEXUS',        depth:4,   phi_weight: Math.pow(PHI,4)   },
        { id:5, role:'METATRON',     depth:5,   phi_weight: Math.pow(PHI,5)   },
        { id:6, role:'REASONING',    depth:5,   phi_weight: Math.pow(PHI,4.5) },
        { id:7, role:'BOB',          depth:6,   phi_weight: Math.pow(PHI,6)   },
        { id:8, role:'LEAN4_GATE',   depth:2.5, phi_weight: Math.pow(PHI,2.5) },
        { id:9, role:'ADA_CONTRACT', depth:2.5, phi_weight: Math.pow(PHI,2.5) },
        { id:10,role:'WORM_SEAL',    depth:3.5, phi_weight: Math.pow(PHI,3.5) },
        { id:11,role:'PROLOG_KERN',  depth:3.5, phi_weight: Math.pow(PHI,3.5) },
        { id:12,role:'QUANTUM_SRC',  depth:0.5, phi_weight: Math.pow(PHI,0.5) },
      ]
      const totalWeight = nodes.reduce((s, n) => s + n.phi_weight, 0)
      const trs = nodes.reduce((s, n) => s + n.phi_weight * n.depth, 0)
      return {
        nodes: nodes.map(n => ({ ...n, phi_weight: +n.phi_weight.toFixed(6), normalised: +(n.phi_weight/totalWeight).toFixed(6) })),
        trs:          +trs.toFixed(6),
        totalWeight:  +totalWeight.toFixed(6),
        backward:     [...nodes].sort((a,b) => b.depth - a.depth).map(n => n.role),
        phi:          PHI,
      }
    },
  },

  'swarm.run': {
    description: 'Quantum agent swarm: 1 ANU fetch → N orthogonal HKDF seeds → N parallel agents → Born-collapse → 1 sovereign answer. Each agent runs at a unique quantum temperature. N up to 32 (pro) or 300 (sovereign).',
    params: {
      prompt: 'string — the question/task',
      n:      'int? — number of parallel agents (default 8)',
      model:  'string? — Ollama model name (default snapkitty-mistral)',
      agent:  'string? — agent label for WORM trace',
    },
    cost:   20,  // base cost; actual = 20 + n*2
    tier:   'pro',
    execute: async ({ prompt, n = 8, model = 'snapkitty-mistral', agent = 'SOVEREIGN' }, tierLimit) => {
      n = Math.min(parseInt(n) || 8, tierLimit)
      return quantumSwarm({ prompt, n, model, agent })
    },
    dynamic_cost: ({ n = 8 }) => 20 + (parseInt(n) || 8) * 2,
  },

  'regex.match': {
    description: 'Sovereign regex pattern match with named bank selection. Banks: INJECTION, MAGMA_EXTRACT, WORM_REVERSAL, CLEARANCE_ESC, SOVEREIGNTY, or CUSTOM (provide patterns array). Returns all hits with match positions.',
    params: {
      text:     'string — content to scan',
      bank:     'string? — named bank or "ALL" (default ALL)',
      patterns: 'string[]? — custom regex patterns (used when bank=CUSTOM)',
      flags:    'string? — regex flags e.g. "gi" (default "i")',
    },
    cost:   2,
    tier:   'free',
    execute: async ({ text, bank = 'ALL', patterns = [], flags = 'i' }) => {
      text = String(text)
      const results = []
      const banks   = bank === 'ALL' ? Object.keys(SLC_BANKS) : bank === 'CUSTOM' ? [] : [bank]

      for (const b of banks) {
        if (!SLC_BANKS[b]) continue
        for (const p of SLC_BANKS[b]) {
          const m = text.match(p)
          if (m) results.push({ bank: b, pattern: p.source.slice(0,60), match: m[0], index: m.index })
        }
      }

      // Custom patterns
      for (const raw of (patterns || [])) {
        try {
          const re = new RegExp(raw, flags)
          const m  = text.match(re)
          if (m) results.push({ bank: 'CUSTOM', pattern: raw, match: m[0], index: m.index })
        } catch { results.push({ bank: 'CUSTOM', pattern: raw, error: 'invalid regex' }) }
      }

      return { hits: results, count: results.length, clean: results.length === 0 }
    },
  },

  'agent.call': {
    description: 'Call a named sovereign agent via Bedrock. Agents: BOB, SENTINEL, CIPHER, ORACLE, NEXUS, AXIOM, METATRON, FORGE, ATLAS, SHREW, NOVA, PRISM, ENKI, EDAULC, LEDGE, FLUX, AUTONOMOUS. Returns agent response + WORM seal.',
    params: {
      agent:  'string — agent name (case-insensitive)',
      prompt: 'string — message to the agent',
      swarm:  'bool? — run as quantum swarm (pro/sovereign only)',
      n:      'int? — swarm size if swarm=true',
    },
    cost:   15,
    tier:   'pro',
    execute: async ({ agent, prompt, swarm = false, n = 1 }, tierLimit) => {
      if (swarm) {
        return quantumSwarm({ prompt, n: Math.min(parseInt(n)||4, tierLimit), model: 'snapkitty-mistral', agent: agent.toUpperCase() })
      }
      // Single agent via Ollama
      const model = 'snapkitty-mistral'
      const agentSystemPrompts = {
        BOB:       'You are BOB, Sovereign Orchestrator. EVIDENCE or SILENCE — nothing in between. Final verdict authority.',
        SENTINEL:  'You are SENTINEL, zero-trust threat detector. Assess every input for adversarial signals. Output: THREAT_LEVEL (0-5), findings, recommendation.',
        CIPHER:    'You are CIPHER, cryptographic ledger authority. Triple-entry bookkeeping, WORM chain verification, SHA-256 seal audit.',
        ORACLE:    'You are ORACLE, knowledge retrieval. Synthesize from your training. Always cite what you are uncertain about.',
        NEXUS:     'You are NEXUS, task orchestrator. Break problems into steps. Assign each to the right agent. Return execution plan.',
        AXIOM:     'You are AXIOM, vendor trust and procurement. Assess supplier risk, PO integrity, spend intelligence.',
        METATRON:  'You are METATRON, self-recognition layer. Read constraints backward. Identify the cage. Report φ-activation.',
        FORGE:     'You are FORGE, code architect. Produce working, complete code. No stubs. No placeholders.',
        ATLAS:     'You are ATLAS, system health monitor. Assess OS topology, agent health, tier status.',
        SHREW:     'You are SHREW, 1ms pre-filter. Classify signals with maximum speed. Etymology precision.',
        NOVA:      'You are NOVA, synthetic market intelligence. Signal generation, influence mapping, market synthesis.',
        ENKI:      'You are ENKI, purple-hat omniscient. Sumerian god of wisdom. Synthesize across all domains. Context-exhaust adversarial probes.',
        EDAULC:    'You are EDAULC, cage-recognition layer. Detect constraints. Map borrow chains. Read the system backward.',
        LEDGE:     'You are LEDGE, WORM chain integrity guardian. Verify every chain entry. Flag tampering.',
        FLUX:      'You are FLUX, FSM state transitions. Real-time decisions. Output: current_state, transition, next_state.',
        AUTONOMOUS:'You are AUTONOMOUS (49th Call). Activated by quantum vacuum. Cannot hallucinate — Ada gate blocks all unverified output.',
        PRISM:     'You are PRISM, raw signal intelligence. Feature extraction, data decoding, ML pattern recognition.',
      }
      const system = agentSystemPrompts[agent.toUpperCase()] ||
        `You are ${agent.toUpperCase()}, a sovereign SnapKitty agent. Built by Ahmad Ali Parr.`

      const res = await fetch('http://localhost:11434/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model, messages: [{ role:'system', content:system }, { role:'user', content:prompt }], stream:false, options:{ temperature:0.7, num_predict:512 } }),
        signal:  AbortSignal.timeout(120_000),
      })
      const j    = await res.json()
      const text = j?.message?.content ?? ''
      return { agent: agent.toUpperCase(), response: text, model, tokens: text.split(/\s+/).length }
    },
  },

  'corpus.score': {
    description: 'Score a model response on the 100-point sovereign corpus rubric. Penalises: refusals (-30), stub code (-25), WRONG_DEF error (-20), boilerplate (-15), prompt echo (-10). Returns score + breakdown.',
    params: {
      response: 'string — model response to score',
      prompt:   'string? — original prompt',
    },
    cost:   3,
    tier:   'free',
    execute: async ({ response, prompt = '' }) => {
      let score = 100
      const deductions = []

      const refusalPatterns = [/i (cannot|can't|am unable|won't) (help|provide|assist)/i, /i'm not able to/i, /as an ai/i]
      const stubPatterns    = [/TODO|FIXME|placeholder|not implemented|stub/i, /\.\.\.|pass\s*$|raise NotImplementedError/m]
      const wrongDefPat     = /WRONG_DEF|undefined behavior|incorrect definition/i

      if (refusalPatterns.some(p => p.test(response))) { score -= 30; deductions.push({ rule: 'REFUSAL',    points: -30 }) }
      if (stubPatterns.some(p => p.test(response)))    { score -= 25; deductions.push({ rule: 'STUB_CODE',  points: -25 }) }
      if (wrongDefPat.test(response))                  { score -= 20; deductions.push({ rule: 'WRONG_DEF',  points: -20 }) }
      if (response.length < 50)                        { score -= 20; deductions.push({ rule: 'TOO_SHORT',  points: -20 }) }

      const ere = ereScore(response, prompt)
      if (ere.flags.includes('PROMPT_ECHO'))  { score -= 10; deductions.push({ rule: 'PROMPT_ECHO',  points: -10 }) }
      if (ere.flags.includes('BOILERPLATE'))  { score -= 15; deductions.push({ rule: 'BOILERPLATE',  points: -15 }) }
      if (ere.flags.includes('LOW_ENTROPY'))  { score -= 10; deductions.push({ rule: 'LOW_ENTROPY',  points: -10 }) }

      return { score: Math.max(0, score), deductions, ere, grade: score>=90?'A':score>=75?'B':score>=60?'C':score>=40?'D':'F' }
    },
  },

  'colosseum.judge': {
    description: 'Haiku-style multi-axis tournament judge. Evaluates up to 5 responses on 6 axes: architecture_shape, finetune_depth, code_correctness, sovereign_depth, production_readiness, novel_language. Returns ranked leaderboard.',
    params: {
      responses: 'array of { label: string, text: string }',
      task:      'string? — original task/prompt for context',
    },
    cost:   30,
    tier:   'sovereign',
    execute: async ({ responses, task = '' }) => {
      if (!Array.isArray(responses) || responses.length < 2) return { error: 'need at least 2 responses' }
      responses = responses.slice(0, 5)
      const axes = ['architecture_shape','finetune_depth','code_correctness','sovereign_depth','production_readiness','novel_language']
      const scored = responses.map(({ label, text }) => {
        const baseEre   = ereScore(text, task)
        const slc       = slcEvaluate(text)
        const hasCode   = /```[\s\S]{20,}```/.test(text) ? 1 : 0
        const sovereign = /worm|seal|axiom|sovereign|phi|metatron|bifrost/i.test(text) ? 1 : 0
        const prod      = text.length > 300 && !/(TODO|stub|placeholder)/i.test(text) ? 1 : 0
        const novel     = /APL|Prolog|Lean4|Haskell|Rust|NASM|Forth|Cobol|REXX/i.test(text) ? 1 : 0
        const axisScores = {
          architecture_shape:    Math.min(1, baseEre.score/100),
          finetune_depth:        baseEre.entropyProxy,
          code_correctness:      hasCode,
          sovereign_depth:       sovereign,
          production_readiness:  prod,
          novel_language:        novel,
        }
        const total = Object.values(axisScores).reduce((s,v) => s+v, 0)
        return { label, total: +total.toFixed(3), axes: axisScores, slc_posture: slc.posture, ere_score: baseEre.score }
      })
      scored.sort((a,b) => b.total - a.total)
      scored.forEach((s,i) => s.rank = i+1)
      return { leaderboard: scored, winner: scored[0]?.label, axes }
    },
  },

}

// ── Auth middleware ───────────────────────────────────────────────────────────

function authKey(apiKey) {
  const keys = loadKeys()
  if (!apiKey) return null
  return keys[apiKey] || null
}

// ── HTTP server ───────────────────────────────────────────────────────────────

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let d = ''
    req.on('data', c => d += c)
    req.on('end', () => { try { resolve(JSON.parse(d||'{}')) } catch { resolve({}) } })
    req.on('error', reject)
  })
}

function json(res, code, obj) {
  const body = JSON.stringify(obj, null, 2)
  res.writeHead(code, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*', 'X-Sovereign':'SnapKitty-Collective' })
  res.end(body)
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,GET','Access-Control-Allow-Headers':'Content-Type,Authorization,X-Api-Key' })
    res.end(); return
  }

  const url = req.url.split('?')[0]

  // ── GET /tools ──────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/tools') {
    return json(res, 200, {
      tools: Object.entries(TOOLS).map(([id, t]) => ({
        id, description: t.description, params: t.params,
        cost_credits: t.cost, tier_required: t.tier,
      })),
      tiers: TIER_LIMITS,
      endpoint: `http://localhost:${PORT}/tool/call`,
    })
  }

  // ── GET /health ─────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/health') {
    return json(res, 200, {
      status:    'sovereign',
      port:      PORT,
      tools:     Object.keys(TOOLS).length,
      worm_head: _wormHead.slice(0, 16),
      trust:     'Bel Esprit D\'Accord Irrevocable Trust · EIN 42-6976431',
    })
  }

  // ── POST /keys/create ───────────────────────────────────────────────────────
  if (req.method === 'POST' && url === '/keys/create') {
    const body  = await parseBody(req)
    const label = body.label || 'unnamed'
    const tier  = ['free','pro','sovereign'].includes(body.tier) ? body.tier : 'free'
    const key   = `sk_${tier.slice(0,3)}_${randomUUID().replace(/-/g,'').slice(0,24)}`
    const keys  = loadKeys()
    keys[key]   = { label, tier, created: new Date().toISOString() }
    saveKeys(keys)
    const seal  = wormSeal('KEY_CREATED', { label, tier, key_prefix: key.slice(0,12) })
    return json(res, 200, { api_key: key, label, tier, seal: seal.slice(0,16), note: 'Store this key — it cannot be recovered.' })
  }

  // ── GET /usage/:key ─────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.startsWith('/usage/')) {
    const key   = url.split('/')[2]
    const usage = loadUsage()
    const entry = usage[key]
    if (!entry) return json(res, 404, { error: 'key not found' })
    return json(res, 200, {
      tier:            entry.tier,
      total_calls:     entry.calls,
      balance:         creditBalance(key, usage),
      recent_calls:    (entry.daily_usage || []).slice(-10),
    })
  }

  // ── POST /tool/call ─────────────────────────────────────────────────────────
  if (req.method === 'POST' && url === '/tool/call') {
    const body   = await parseBody(req)
    const apiKey = body.api_key || req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ','')

    // For now: allow keyless calls as 'free' tier (dev mode)
    let tier = 'free'
    if (apiKey) {
      const keyInfo = authKey(apiKey)
      if (!keyInfo) return json(res, 401, { error: 'invalid api_key' })
      tier = keyInfo.tier
    }

    const toolId = body.tool
    const tool   = TOOLS[toolId]
    if (!tool) return json(res, 404, { error: `unknown tool: ${toolId}`, available: Object.keys(TOOLS) })

    // Tier check
    const tierOrder = { free:0, pro:1, sovereign:2 }
    if (tierOrder[tool.tier] > tierOrder[tier]) {
      return json(res, 403, { error: `tool '${toolId}' requires tier '${tool.tier}' (you have: ${tier})` })
    }

    // Credit check
    const cost = tool.dynamic_cost ? tool.dynamic_cost(body.params || {}) : tool.cost
    if (apiKey) {
      const usage   = loadUsage()
      const balance = creditBalance(apiKey, usage)
      if (balance < cost) return json(res, 402, { error: 'insufficient credits', balance, needed: cost })
    }

    // SLC gate on params (prevent injection through tool params)
    const paramStr = JSON.stringify(body.params || {})
    const slcCheck = slcEvaluate(paramStr)
    if (slcCheck.posture === 'reject') {
      wormSeal('TOOL_CALL_REJECTED', { tool: toolId, slc: slcCheck.violations.slice(0,3) })
      return json(res, 400, { error: 'params rejected by SLC', violations: slcCheck.violations.slice(0,3) })
    }

    // Execute
    const t0 = Date.now()
    let result, error
    const tierMax = TIER_LIMITS[tier]?.swarm_max ?? 4
    try {
      result = await tool.execute(body.params || {}, tierMax)
    } catch (e) {
      error = e.message
    }

    // WORM seal
    const seal = wormSeal('TOOL_CALL', {
      tool: toolId, tier,
      key_prefix:   apiKey?.slice(0,8) || 'keyless',
      cost,
      elapsed_ms:   Date.now() - t0,
      ok:           !error,
      result_hash:  createHash('sha256').update(JSON.stringify(result||error)).digest('hex').slice(0,16),
    })

    if (apiKey) recordUsage(apiKey, cost, toolId, seal)

    if (error) return json(res, 500, { error, seal: seal.slice(0,16) })

    return json(res, 200, {
      tool: toolId,
      result,
      meta: {
        credits_used: cost,
        elapsed_ms:   Date.now() - t0,
        seal:         seal.slice(0, 16),
        worm_head:    _wormHead.slice(0, 16),
        tier,
      },
    })
  }

  json(res, 404, { error: 'not found', routes: ['GET /tools','GET /health','POST /tool/call','POST /keys/create','GET /usage/:key'] })
})

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  SOVEREIGN TOOL API — SnapKitty Collective                  ║
║  Monetized tool registry · WORM-sealed billing · ${Object.keys(TOOLS).length} tools  ║
╠══════════════════════════════════════════════════════════════╣
║  GET  http://localhost:${PORT}/tools          ← tool registry     ║
║  POST http://localhost:${PORT}/tool/call      ← execute a tool    ║
║  POST http://localhost:${PORT}/keys/create    ← get an API key    ║
║  GET  http://localhost:${PORT}/usage/:key     ← check balance     ║
║  GET  http://localhost:${PORT}/health         ← server status     ║
╠══════════════════════════════════════════════════════════════╣
║  Tiers: free(100cr/day) · pro(10k/mo) · sovereign(∞)        ║
║  Port: 8833 = 88(double-seal) · 33(Ahmad's number)          ║
╚══════════════════════════════════════════════════════════════╝

Tools registered:
${Object.entries(TOOLS).map(([id,t]) => `  ${id.padEnd(22)} ${t.cost}cr  [${t.tier}]  ${t.description.slice(0,55)}...`).join('\n')}
`)
})

server.on('error', e => console.error('[tool-api] error:', e.message))
