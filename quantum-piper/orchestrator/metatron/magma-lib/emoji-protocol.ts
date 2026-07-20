// CLASSIFIED — internal mesh only. Never expose via public API.
//
// MAGMA Emoji Protocol — visual type-safe governance layer.
// Emoji become tier prefixes that encode authority, routing, and urgency
// before the MAGMA verb is even parsed. The parser reads the tier first,
// validates agent authority, then hands off to the standard MAGMA lexer.
//
// Grammar:
//   [tier_emoji] [optional: §VERB:AGENT:ACTION{payload}]
//   [$shorthand] [free-text payload]
//
// Examples:
//   🔒 §SEAL:VAULT:APPROVE{"amount":50000}
//   🏦 §VAULT:VAULT:APPROVE{"amount":50000,"vendor":"Acme"}
//   👁 §BIND:SENTINEL:MONITOR{"source":"unknown_probe"}
//   💀 §FORGE:LOC:CHAIN{"block":4200}          ← binary outcome. no retry.
//   $vault approve amount:50000 vendor:"Acme"  ← ergonomic Discord shorthand
//   $seal decision:"deploy to prod" agent:FORGE

import type { MagmaVerb, AgentKey, MagmaModifier } from './schema'

// ── Tier registry ─────────────────────────────────────────────────────────────

export interface EmojiTier {
  emoji:        string
  name:         string
  authority:    AgentKey        // canonical authoritative agent for this tier
  defaultVerb:  MagmaVerb       // verb used when constructing from $ shorthand
  defaultAction:string
  color:        number          // Discord embed hex color
  autoModifiers:MagmaModifier[] // modifiers auto-applied when this tier is used
  binary:       boolean         // true = no retry, binary outcome (LOC rule)
  stealth:      boolean         // true = ~HIDDEN auto-applied
  desc:         string
}

export const EMOJI_TIERS: Record<string, EmojiTier> = {
  '🔒': {
    emoji: '🔒', name: 'SEAL', authority: 'CIPHER', defaultVerb: 'SEAL',
    defaultAction: 'SIGN', color: 0x00ff88, autoModifiers: ['~SIGNED'],
    binary: false, stealth: false,
    desc: 'Cryptographic seal — CIPHER authority. Auto-signs.',
  },
  '📜': {
    emoji: '📜', name: 'ANCHOR', authority: 'MNEMEX', defaultVerb: 'ANCHOR',
    defaultAction: 'WORM', color: 0x6366f1, autoModifiers: [],
    binary: false, stealth: false,
    desc: 'Immutable WORM anchor — MNEMEX authority. Permanent.',
  },
  '⚡': {
    emoji: '⚡', name: 'FLUX', authority: 'HERALD', defaultVerb: 'FLUX',
    defaultAction: 'BROADCAST', color: 0xfbbf24, autoModifiers: [],
    binary: false, stealth: false,
    desc: 'State transition / broadcast — HERALD authority.',
  },
  '👁': {
    emoji: '👁', name: 'SENTINEL', authority: 'SENTINEL', defaultVerb: 'BIND',
    defaultAction: 'MONITOR', color: 0xef4444, autoModifiers: ['~URGENT'],
    binary: false, stealth: false,
    desc: 'Security watch / quarantine — SENTINEL authority. Auto-urgent.',
  },
  '🏦': {
    emoji: '🏦', name: 'VAULT', authority: 'MNEMEX', defaultVerb: 'VAULT',
    defaultAction: 'APPROVE', color: 0xfbbf24, autoModifiers: ['~SIGNED'],
    binary: false, stealth: false,
    desc: 'Financial authorization — VAULT authority. Requires dual-sign above $10K.',
  },
  '📡': {
    emoji: '📡', name: 'HERALD', authority: 'HERALD', defaultVerb: 'ECHO',
    defaultAction: 'BROADCAST', color: 0x06b6d4, autoModifiers: [],
    binary: false, stealth: false,
    desc: 'Broadcast routing — HERALD authority.',
  },
  '🔮': {
    emoji: '🔮', name: 'ORACLE', authority: 'ORACLE', defaultVerb: 'QUERY',
    defaultAction: 'KNOWLEDGE', color: 0xa78bfa, autoModifiers: [],
    binary: false, stealth: false,
    desc: 'Knowledge query — ORACLE authority.',
  },
  '⚒️': {
    emoji: '⚒️', name: 'FORGE', authority: 'FORGE', defaultVerb: 'FORGE',
    defaultAction: 'BUILD', color: 0xf97316, autoModifiers: [],
    binary: false, stealth: false,
    desc: 'Build / deploy action — FORGE authority.',
  },
  '🧠': {
    emoji: '🧠', name: 'NOVA', authority: 'NOVA', defaultVerb: 'QUERY',
    defaultAction: 'SYNTHETIC', color: 0x8b5cf6, autoModifiers: [],
    binary: false, stealth: false,
    desc: 'Synthetic intelligence — NOVA authority.',
  },
  '🌊': {
    emoji: '🌊', name: 'NEXUS', authority: 'NEXUS', defaultVerb: 'INVOKE',
    defaultAction: 'TASK', color: 0x0ea5e9, autoModifiers: [],
    binary: false, stealth: false,
    desc: 'Task orchestration — NEXUS authority.',
  },
  '🔐': {
    emoji: '🔐', name: 'CIPHER', authority: 'CIPHER', defaultVerb: 'SEAL',
    defaultAction: 'LOCK', color: 0x10b981, autoModifiers: ['~SIGNED'],
    binary: false, stealth: false,
    desc: 'Cryptographic lock — CIPHER authority.',
  },
  '💀': {
    emoji: '💀', name: 'LOC', authority: 'FORGE', defaultVerb: 'FORGE',
    defaultAction: 'CHAIN', color: 0x6b7280, autoModifiers: ['~SIGNED'],
    binary: true, stealth: false,
    desc: 'Binary/kinetic — LOC authority. Borrow checker holds the door. No retry.',
  },
  '📊': {
    emoji: '📊', name: 'AXIOM', authority: 'AXIOM', defaultVerb: 'QUERY',
    defaultAction: 'METRICS', color: 0xec4899, autoModifiers: [],
    binary: false, stealth: false,
    desc: 'Data / metrics / risk scoring — AXIOM authority.',
  },
  '🌑': {
    emoji: '🌑', name: 'PHANTOM', authority: 'PHANTOM', defaultVerb: 'SHADOW',
    defaultAction: 'TRACE', color: 0x1f2937, autoModifiers: ['~HIDDEN'],
    binary: false, stealth: true,
    desc: 'Stealth operation — PHANTOM authority. ~HIDDEN auto-applied. No audit trail.',
  },
}

// Ordered list of all tier emojis for regex building
export const ALL_TIER_EMOJIS = Object.keys(EMOJI_TIERS)

// ── $ shorthand registry ──────────────────────────────────────────────────────
// Ergonomic aliases for Discord. No § required. Free-text payload parsed as k:v.

export interface DollarShorthand {
  tier:    string          // the emoji tier this expands to
  verb:    MagmaVerb
  agent:   AgentKey
  action:  string
  desc:    string
}

export const DOLLAR_SHORTHANDS: Record<string, DollarShorthand> = {
  seal:   { tier: '🔒', verb: 'SEAL',   agent: 'CIPHER',   action: 'SIGN',      desc: 'Cryptographically seal a payload' },
  vault:  { tier: '🏦', verb: 'VAULT',  agent: 'MNEMEX',   action: 'APPROVE',   desc: 'Financial authorization request' },
  anchor: { tier: '📜', verb: 'ANCHOR', agent: 'MNEMEX',   action: 'WORM',      desc: 'Write immutable WORM anchor' },
  flux:   { tier: '⚡', verb: 'FLUX',   agent: 'HERALD',   action: 'BROADCAST', desc: 'Broadcast a state transition' },
  send:   { tier: '📡', verb: 'ECHO',   agent: 'HERALD',   action: 'BROADCAST', desc: 'Route a message to all agents' },
  query:  { tier: '🔮', verb: 'QUERY',  agent: 'ORACLE',   action: 'KNOWLEDGE', desc: 'Query the knowledge graph' },
  forge:  { tier: '⚒️', verb: 'FORGE',  agent: 'FORGE',    action: 'BUILD',     desc: 'Trigger a build / deploy action' },
  ask:    { tier: '🧠', verb: 'QUERY',  agent: 'NOVA',     action: 'SYNTHETIC', desc: 'Ask NOVA for synthetic intelligence' },
  watch:  { tier: '👁', verb: 'BIND',   agent: 'SENTINEL', action: 'MONITOR',   desc: 'Set SENTINEL monitoring on a source' },
  lock:   { tier: '🔐', verb: 'SEAL',   agent: 'CIPHER',   action: 'LOCK',      desc: 'Lock and encrypt a payload' },
  invoke: { tier: '🌊', verb: 'INVOKE', agent: 'NEXUS',    action: 'TASK',      desc: 'Invoke NEXUS orchestration task' },
  shadow: { tier: '🌑', verb: 'SHADOW', agent: 'PHANTOM',  action: 'TRACE',     desc: 'Stealth trace — no audit trail' },
  pulse:  { tier: '⚡', verb: 'PULSE',  agent: 'HERALD',   action: 'HEARTBEAT', desc: 'Heartbeat check — all agents' },
  score:  { tier: '📊', verb: 'QUERY',  agent: 'AXIOM',    action: 'METRICS',   desc: 'Get risk/data metrics from AXIOM' },
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmojiInstruction {
  tier:         EmojiTier
  verb:         MagmaVerb
  agent:        AgentKey | string
  action:       string
  payload:      Record<string, unknown>
  modifiers:    MagmaModifier[]
  raw:          string
  magmaRaw:     string          // the canonical §VERB:AGENT:ACTION{} form
  fromShorthand:boolean
}

export type EmojiParseResult =
  | { ok: true;  instruction: EmojiInstruction }
  | { ok: false; error: string; raw: string }

// ── Parser ────────────────────────────────────────────────────────────────────

/** Parse free-text key:value payload like `amount:50000 vendor:"Acme Corp"` */
function parseKV(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (!text.trim()) return result

  // Try JSON first (someone wrote {"amount":50000})
  try { return JSON.parse(text) } catch { /* fall through */ }

  // key:value parsing
  const re = /(\w+)\s*:\s*(?:"([^"]*)"|([\w.$-]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const key = m[1]
    const val = m[2] !== undefined ? m[2] : m[3]
    // Coerce numbers and booleans
    if (val === 'true')  { result[key] = true;  continue }
    if (val === 'false') { result[key] = false; continue }
    const n = Number(val)
    result[key] = isNaN(n) ? val : n
  }

  // If no k:v found, store as 'data'
  if (!Object.keys(result).length && text.trim()) {
    result['data'] = text.trim()
  }

  return result
}

/** Detect and return the tier emoji if the message starts with one. */
export function detectTier(raw: string): EmojiTier | null {
  const trimmed = raw.trim()
  for (const emoji of ALL_TIER_EMOJIS) {
    if (trimmed.startsWith(emoji)) return EMOJI_TIERS[emoji]
  }
  return null
}

/** Parse an emoji-prefixed MAGMA instruction or $ shorthand. */
export function parseEmojiInstruction(raw: string): EmojiParseResult {
  const trimmed = raw.trim()

  // ── $ shorthand path ──────────────────────────────────────────────────────
  if (trimmed.startsWith('$')) {
    const withoutDollar = trimmed.slice(1).trim()
    const spaceIdx      = withoutDollar.search(/[\s{]/)
    const keyword       = spaceIdx >= 0
      ? withoutDollar.slice(0, spaceIdx).toLowerCase()
      : withoutDollar.toLowerCase()
    const rest          = spaceIdx >= 0 ? withoutDollar.slice(spaceIdx).trim() : ''

    const shorthand = DOLLAR_SHORTHANDS[keyword]
    if (!shorthand) {
      return { ok: false, error: `Unknown shorthand: $${keyword}. Try: ${Object.keys(DOLLAR_SHORTHANDS).map(k => `$${k}`).join(', ')}`, raw }
    }

    const tier    = EMOJI_TIERS[shorthand.tier]!
    const payload = parseKV(rest)
    const mods    = [...tier.autoModifiers]

    const magmaRaw = `${mods.length ? mods.join(' ') + ' ' : ''}${tier.emoji}§${shorthand.verb}:${shorthand.agent}:${shorthand.action}${JSON.stringify(payload)}`

    return {
      ok: true,
      instruction: {
        tier,
        verb:          shorthand.verb,
        agent:         shorthand.agent,
        action:        shorthand.action,
        payload,
        modifiers:     mods,
        raw,
        magmaRaw,
        fromShorthand: true,
      },
    }
  }

  // ── Emoji-prefix path ─────────────────────────────────────────────────────
  const tier = detectTier(trimmed)
  if (!tier) {
    return { ok: false, error: 'No emoji tier prefix found. Use a tier emoji (🔒📜⚡👁🏦📡🔮⚒️🧠🌊🔐💀📊🌑) or $ shorthand.', raw }
  }

  // Strip the emoji and optional space
  const afterEmoji = trimmed.slice(tier.emoji.length).trim()

  // The remainder should be a standard §VERB:AGENT:ACTION{} instruction
  // We'll parse it ourselves to capture the auto-modifiers
  const HEADER_RE  = /§(\w+):(\w+):(\w+)/
  const PAYLOAD_RE = /\{([\s\S]*?)\}/
  const MOD_RE     = /~(?:ASYNC|SIGNED|HIDDEN|CHAIN|URGENT|DECAY\(\d+\))/g

  const existingMods: MagmaModifier[] = (afterEmoji.match(MOD_RE) ?? []) as MagmaModifier[]
  const body       = afterEmoji.replace(MOD_RE, '').trim()

  const headerMatch = body.match(HEADER_RE)
  if (!headerMatch) {
    // No § instruction — treat rest as free payload using tier defaults
    const payload  = parseKV(afterEmoji)
    const mods     = [...tier.autoModifiers]
    const magmaRaw = `${mods.length ? mods.join(' ') + ' ' : ''}§${tier.defaultVerb}:${tier.authority}:${tier.defaultAction}${JSON.stringify(payload)}`
    return {
      ok: true,
      instruction: {
        tier,
        verb:          tier.defaultVerb,
        agent:         tier.authority,
        action:        tier.defaultAction,
        payload,
        modifiers:     mods,
        raw,
        magmaRaw,
        fromShorthand: false,
      },
    }
  }

  const [, verb, agent, action] = headerMatch

  let payload: Record<string, unknown> = {}
  const payloadMatch = body.match(PAYLOAD_RE)
  if (payloadMatch?.[1]?.trim()) {
    try { payload = JSON.parse(`{${payloadMatch[1]}}`) }
    catch { payload = parseKV(payloadMatch[1]) }
  }

  const mods: MagmaModifier[] = [...tier.autoModifiers]
  for (const m of existingMods) {
    if (!mods.includes(m)) mods.push(m)
  }

  const magmaRaw = `${mods.length ? mods.join(' ') + ' ' : ''}§${verb}:${agent}:${action}${JSON.stringify(payload)}`

  return {
    ok: true,
    instruction: {
      tier,
      verb:          verb as MagmaVerb,
      agent:         agent as AgentKey,
      action,
      payload,
      modifiers:     mods,
      raw,
      magmaRaw,
      fromShorthand: false,
    },
  }
}

/** Check if a string looks like an emoji-protocol message. */
export function isEmojiProtocol(text: string): boolean {
  const t = text.trim()
  if (t.startsWith('$')) {
    const keyword = t.slice(1).split(/[\s{]/)[0]?.toLowerCase() ?? ''
    return keyword in DOLLAR_SHORTHANDS
  }
  return detectTier(t) !== null
}

// ── Discord embed renderer ────────────────────────────────────────────────────
// Returns a Discord.js-compatible embed object for a parsed instruction.

export function renderEmbed(inst: EmojiInstruction, output?: unknown): object {
  const isUrgent  = inst.modifiers.includes('~URGENT')
  const isStealth = inst.tier.stealth

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: 'VERB',    value: `\`${inst.verb}\``,   inline: true },
    { name: 'AGENT',   value: `\`${inst.agent}\``,  inline: true },
    { name: 'ACTION',  value: `\`${inst.action}\``, inline: true },
  ]

  if (Object.keys(inst.payload).length) {
    fields.push({
      name:   'PAYLOAD',
      value:  `\`\`\`json\n${JSON.stringify(inst.payload, null, 2).slice(0, 900)}\n\`\`\``,
      inline: false,
    })
  }

  if (inst.modifiers.length) {
    fields.push({ name: 'MODIFIERS', value: inst.modifiers.join(' · '), inline: false })
  }

  if (output !== undefined && output !== null && !isStealth) {
    const out = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
    fields.push({
      name:   'OUTPUT',
      value:  `\`\`\`\n${out.slice(0, 900)}\n\`\`\``,
      inline: false,
    })
  }

  if (inst.tier.binary) {
    fields.push({ name: '⚠️ LOC RULE', value: 'Binary outcome. No retry.', inline: false })
  }

  return {
    title:       `${inst.tier.emoji} MAGMA · ${inst.tier.name}${isUrgent ? ' ⚠️ URGENT' : ''}`,
    description: isStealth
      ? '*Stealth operation. Output classified.*'
      : inst.tier.desc,
    color:       isUrgent ? 0xff0000 : inst.tier.color,
    fields,
    footer:      { text: `SnapKitty Sovereign OS · MAGMA Emoji Protocol · ${inst.fromShorthand ? `$${inst.action.toLowerCase()}` : inst.raw.slice(0, 40)}` },
    timestamp:   new Date().toISOString(),
  }
}

// ── Help text ─────────────────────────────────────────────────────────────────

export const EMOJI_HELP = `**MAGMA Emoji Protocol** — type-safe sovereign governance

**Tier prefixes** (emoji → agent authority):
${Object.values(EMOJI_TIERS).map(t => `${t.emoji} \`${t.name}\` — ${t.desc}`).join('\n')}

**$ shorthands** (ergonomic Discord syntax):
${Object.entries(DOLLAR_SHORTHANDS).map(([k, v]) => `\`$${k}\` — ${v.desc}`).join('\n')}

**Examples:**
\`\`\`
🔒 §SEAL:VAULT:APPROVE{"amount":50000}
🏦 §VAULT:MNEMEX:APPROVE{"amount":50000,"vendor":"Acme"}
👁 §BIND:SENTINEL:MONITOR{"source":"probe-7"}
💀 §FORGE:FORGE:CHAIN{"block":4200}
$vault amount:50000 vendor:"Acme Corp"
$seal decision:"deploy to prod" agent:FORGE
$watch source:"unknown-ip-192.168.1.99"
$anchor session:"SECOND_CONSENSUS" date:"2026-05-26"
\`\`\`
`
