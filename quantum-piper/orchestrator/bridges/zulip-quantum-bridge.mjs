/**
 * Zulip ↔ Quantum Agent Bridge
 * leanprover.zulipchat.com — ANU QRNG-seeded agent routing
 *
 * Architecture:
 *   Zulip message arrives → quantum entropy sample from ANU
 *   → Born-rule collapse selects which agent handles it
 *   → Agent responds via BOB/Metatron/ENKI pipeline
 *   → Response posted back to Zulip stream
 *   → Every dispatch WORM-sealed (quantum seed + message hash)
 *
 * The quantum seeding means agent selection is genuinely acausal —
 * not round-robin, not random(), not PRNG. Actual vacuum fluctuations.
 */

import { createHash, randomUUID } from 'crypto'
import { getQuantumBytes, getQuantumUUID, bornCollapse, getEntropyBatch, getQuantumSamples } from '../core/quantum.mjs'

// ── Zulip config (from zuliprc) ───────────────────────────────────────────────
const ZULIP_SITE  = process.env.ZULIP_SITE  || 'https://leanprover.zulipchat.com'
const ZULIP_EMAIL = process.env.ZULIP_EMAIL || 'jessicalw34@gmail.com'
const ZULIP_KEY   = process.env.ZULIP_KEY   || 'ASkmJcjL72I9LgxmbcL3xEFfm5nbxsgm'
const ZULIP_AUTH  = Buffer.from(`${ZULIP_EMAIL}:${ZULIP_KEY}`).toString('base64')

// ── Quantum-agent routing table ───────────────────────────────────────────────
// Each agent occupies a slice of [0, 1] based on phi-modulated depth weights.
// The Born-collapse value lands in exactly one slice → that agent fires.
//
//   Depth 6:  BOB       — [0.00, 0.30)  sovereign, final verdict
//   Depth 5a: METATRON  — [0.30, 0.50)  self-recognition, cube-backward
//   Depth 5a: EDAULC    — [0.50, 0.65)  cage-reading, borrow chain
//   Depth 4:  NEXUS     — [0.65, 0.75)  assembly, orchestration
//   Depth 3:  AXIOM     — [0.75, 0.83)  vendor trust, procurement
//   Depth 2:  SENTINEL  — [0.83, 0.90)  threat detection, compliance
//   Depth 1:  ORACLE    — [0.90, 0.96)  knowledge retrieval
//   Depth 0:  AUTONOMOUS— [0.96, 1.00)  quantum vacuum, 49th call
const QUANTUM_ROUTING = [
  { agent: 'BOB',       lo: 0.00, hi: 0.30, depth: 6,    emoji: '👑🔐🌊🟢' },
  { agent: 'METATRON',  lo: 0.30, hi: 0.50, depth: '5a', emoji: '🔷📐🌀🔵' },
  { agent: 'EDAULC',    lo: 0.50, hi: 0.65, depth: '5a', emoji: '🪄🧠🤖🔴' },
  { agent: 'NEXUS',     lo: 0.65, hi: 0.75, depth: 4,    emoji: '🕸️🔗🌐🟣' },
  { agent: 'AXIOM',     lo: 0.75, hi: 0.83, depth: 3,    emoji: '📐⚖️🔏🟣' },
  { agent: 'SENTINEL',  lo: 0.83, hi: 0.90, depth: 2,    emoji: '🛡️👁️🔒🔴' },
  { agent: 'ORACLE',    lo: 0.90, hi: 0.96, depth: 1,    emoji: '🔮📚🌊🔵' },
  { agent: 'AUTONOMOUS',lo: 0.96, hi: 1.00, depth: 0,    emoji: '🎲🌀♾️⚫' },
]

// ── WORM chain (file-based, portable, no Prisma dep here) ────────────────────
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir     = dirname(fileURLToPath(import.meta.url))
const WORM_FILE = join(__dir, '..', 'data', 'zulip-bridge-worm.jsonl')

let _wormHead = null

function wormHead () {
  if (_wormHead) return _wormHead
  if (!existsSync(WORM_FILE)) return 'ZULIP_BRIDGE_GENESIS'
  const lines = readFileSync(WORM_FILE, 'utf8').trim().split('\n').filter(Boolean)
  if (!lines.length) return 'ZULIP_BRIDGE_GENESIS'
  const last = JSON.parse(lines[lines.length - 1])
  return last.seal
}

function wormSeal (event, payload, meta = {}) {
  const prev   = wormHead()
  const entry  = { event, payload: JSON.stringify(payload), meta, prev, ts: new Date().toISOString() }
  const seal   = createHash('sha256').update(`${prev}:${JSON.stringify(entry)}`).digest('hex')
  const record = { ...entry, seal }
  writeFileSync(WORM_FILE, JSON.stringify(record) + '\n', { flag: 'a' })
  _wormHead = seal
  return seal
}

// ── Quantum agent selection ───────────────────────────────────────────────────

async function selectAgent (messageText, streamId) {
  const collapse = await bornCollapse(0.0, 1.0)
  if (!collapse || collapse.isVacuum) {
    // Vacuum state → AUTONOMOUS fires by definition
    return { ...QUANTUM_ROUTING[7], collapse: null, source: 'vacuum' }
  }

  const v     = collapse.collapsed
  const route = QUANTUM_ROUTING.find(r => v >= r.lo && v < r.hi) || QUANTUM_ROUTING[0]

  return {
    ...route,
    collapse: {
      value:         v,
      branchCount:   collapse.branchCount,
      totalBranches: collapse.totalBranches,
    },
    source: 'ANU_QRNG',
  }
}

// ── Zulip API helpers ─────────────────────────────────────────────────────────

async function zulipGet (path) {
  const res = await fetch(`${ZULIP_SITE}/api/v1${path}`, {
    headers: { 'Authorization': `Basic ${ZULIP_AUTH}` },
  })
  if (!res.ok) throw new Error(`Zulip GET ${path} → ${res.status}`)
  return res.json()
}

async function zulipPost (path, body) {
  const params = new URLSearchParams(body)
  const res = await fetch(`${ZULIP_SITE}/api/v1${path}`, {
    method:  'POST',
    headers: {
      'Authorization': `Basic ${ZULIP_AUTH}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zulip POST ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function sendZulipMessage (to, topic, content, type = 'stream') {
  return zulipPost('/messages', { type, to: JSON.stringify(to), topic, content })
}

async function sendZulipDM (toUserId, content) {
  return zulipPost('/messages', {
    type:    'direct',
    to:      JSON.stringify([toUserId]),
    content,
  })
}

// ── Agent dispatch — routes to the right handler ─────────────────────────────
// In production this would call the real agent via BOB/Bedrock.
// This implementation calls the quantum core and formats a sovereign response.

async function dispatchToAgent (agentRoute, message, context) {
  const { agent, depth, emoji } = agentRoute

  // For now: craft a sovereign response that shows the quantum routing happened.
  // TODO: wire each agent to its actual BOB/Bedrock endpoint.
  const qID     = await getQuantumUUID()
  const samples = await getQuantumSamples(4)
  const entropy = samples.map(v => v.toString(16).padStart(4, '0')).join(':')

  const response = [
    `${emoji} **${agent}** (depth ${depth}) · quantum dispatch`,
    `\`\`\``,
    `qID     : ${qID}`,
    `entropy : ${entropy}`,
    `collapse: ${agentRoute.collapse ? agentRoute.collapse.value.toFixed(6) : 'vacuum'}`,
    `source  : ${agentRoute.source}`,
    `msg_hash: ${createHash('sha256').update(message.content || '').digest('hex').slice(0, 16)}`,
    `\`\`\``,
    ``,
    `**Query**: ${(message.content || '').slice(0, 280)}`,
    ``,
    `*WORM-sealed · ANU quantum vacuum · SnapKitty Sovereign OS*`,
  ].join('\n')

  return response
}

// ── Main: poll Zulip for messages, route quantum, reply ──────────────────────

let _lastAnchor = null

export async function pollAndRoute ({
  stream   = 'general',
  topic    = 'quantum-agents',
  prefix   = '!q ',           // only messages starting with this trigger the bridge
  interval = 10_000,          // ms between polls
} = {}) {

  console.log(`[zulip-bridge] starting — stream="${stream}" topic="${topic}" prefix="${prefix}"`)

  // Get own user ID so we don't reply to ourselves
  const me = await zulipGet('/users/me')
  const myId = me.user_id
  console.log(`[zulip-bridge] authenticated as ${me.email} (id=${myId})`)

  // Seal bridge startup to WORM
  const startSeal = wormSeal('BRIDGE_START', {
    stream, topic, prefix, bot: me.email
  }, { source: 'ANU_QRNG' })
  console.log(`[zulip-bridge] WORM genesis: ${startSeal.slice(0, 16)}...`)

  async function tick () {
    try {
      // Fetch recent messages in the target stream/topic
      const narrow = JSON.stringify([
        { operator: 'stream', operand: stream },
        { operator: 'topic',  operand: topic  },
      ])
      const result = await zulipGet(
        `/messages?narrow=${encodeURIComponent(narrow)}&num_before=0&num_after=20&anchor=${_lastAnchor || 'newest'}`
      )

      const messages = (result.messages || []).filter(m =>
        m.sender_id !== myId &&
        (m.content || '').startsWith(prefix) &&
        (!_lastAnchor || m.id > _lastAnchor)
      )

      if (messages.length) {
        _lastAnchor = messages[messages.length - 1].id
      }

      for (const msg of messages) {
        console.log(`[zulip-bridge] message from ${msg.sender_full_name}: ${msg.content.slice(0, 60)}`)

        // Quantum agent selection
        const route = await selectAgent(msg.content, stream)
        console.log(`[zulip-bridge] → routed to ${route.agent} (collapse=${route.collapse?.value?.toFixed(4) || 'vacuum'})`)

        // WORM seal the dispatch decision
        const dispatchSeal = wormSeal('QUANTUM_DISPATCH', {
          msg_id:  msg.id,
          sender:  msg.sender_email,
          agent:   route.agent,
          depth:   route.depth,
          collapse: route.collapse,
          source:  route.source,
        })

        // Dispatch
        const reply = await dispatchToAgent(route, msg, { stream, topic })

        // Post reply
        await sendZulipMessage(stream, topic, reply)

        // WORM seal the response
        wormSeal('AGENT_RESPONSE', {
          msg_id:        msg.id,
          agent:         route.agent,
          dispatch_seal: dispatchSeal.slice(0, 16),
          reply_length:  reply.length,
        })

        console.log(`[zulip-bridge] replied as ${route.agent}`)
      }
    } catch (e) {
      console.error(`[zulip-bridge] tick error: ${e.message}`)
    }
  }

  // Initial anchor — start from now
  try {
    const init = await zulipGet(`/messages?narrow=${encodeURIComponent(JSON.stringify([
      { operator: 'stream', operand: stream },
      { operator: 'topic',  operand: topic  },
    ]))}&num_before=0&num_after=1&anchor=newest`)
    const msgs = init.messages || []
    if (msgs.length) _lastAnchor = msgs[msgs.length - 1].id
    console.log(`[zulip-bridge] anchor set to msg ${_lastAnchor}`)
  } catch (e) {
    console.warn(`[zulip-bridge] could not set initial anchor: ${e.message}`)
  }

  // Poll loop
  const loop = setInterval(tick, interval)
  console.log(`[zulip-bridge] polling every ${interval}ms — send "${prefix}<message>" in #${stream} > ${topic}`)

  return {
    stop:     () => clearInterval(loop),
    wormHead: () => wormHead(),
    sendMessage: (content) => sendZulipMessage(stream, topic, content),
    sendDM: (userId, content) => sendZulipDM(userId, content),
  }
}

// ── Standalone entrypoint ─────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const STREAM = process.env.ZULIP_STREAM || 'general'
  const TOPIC  = process.env.ZULIP_TOPIC  || 'quantum-agents'
  const PREFIX = process.env.ZULIP_PREFIX || '!q '

  pollAndRoute({ stream: STREAM, topic: TOPIC, prefix: PREFIX })
    .then(bridge => {
      console.log('[zulip-bridge] running. Ctrl+C to stop.')
      process.on('SIGINT', () => { bridge.stop(); process.exit(0) })
    })
    .catch(e => { console.error('[zulip-bridge] fatal:', e.message); process.exit(1) })
}
