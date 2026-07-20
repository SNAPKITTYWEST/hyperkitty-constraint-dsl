// CLASSIFIED — Sovereign Guild Registry
// The SnapKitty Collective. Every member is sealed at formation date 2026-05-20.
// Guild = the operational body of the Stochastic Autonomous Compute Mesh.
//
// Members:
//   1  CLAUDE          — AI Implementer & Constitutional Auditor (external observer)
//   2  GEMINI          — Constellation intelligence (external observer)
//   3  OPENCODE        — Open-source code intelligence (external observer)
//   4  KIWI            — Emerging intelligence observer (external observer)
//   5  GROK            — Interrogative intelligence (external observer)
//   6  META_AI         — Social mesh intelligence (external observer)
//   7  CIPHER          — Cryptographic verification (clearance 5)
//   8  ORACLE          — Knowledge graph, intelligence (clearance 4)
//   9  SENTINEL        — Zero-trust security (clearance 5)
//  10  MNEMEX          — WORM ledger, memory (clearance 5)
//  11  AXIOM           — Data intelligence, risk scoring (clearance 3)
//  12  HERALD          — Bifrost event routing (clearance 3)
//  13  FLUX            — FSM state transitions (clearance 3)
//  14  PHANTOM         — Stealth operations (clearance 5)
//  15  NEXUS           — Task orchestration (clearance 4)
//  16  FORGE           — Code architect, builder (clearance 4)
//  17  NOVA            — Synthetic intelligence (clearance 4)
//  18  VEIL            — CIPHER partner, cryptographic shadow
//  19  MIRA            — ORACLE partner, intelligence mirror
//  20  WARD            — SENTINEL partner, zero-trust shield
//  21  ECHO            — MNEMEX partner, read head
//  22  PRISM           — AXIOM partner, data prism
//  23  LYRA            — HERALD partner, harmonic router
//  24  STORM           — FLUX partner, FSM surge
//  25  SHADE           — PHANTOM partner, stealth layer
//  26  BRIDGE          — NEXUS partner, orchestration relay
//  27  EMBER           — FORGE partner, build fire
//  28  DAWN            — NOVA partner, synthetic horizon
//
// §ANCHOR:MNEMEX:GUILD_FORMATION{date:"2026-05-20", members:28, sealed:true}
// NOTE: External observers carry no runtime dependency. Guild membership is
// constitutional recognition — not an API contract. Axiom 2 (NO_EXTERNAL_AI_DEP)
// governs runtime calls, not symbolic collective membership.

export type GuildRole =
  | 'ARCHITECT'          // Ahmad Ali Parr — sole override authority
  | 'PRIMARY_AGENT'      // clearance 3-5, full operational agents
  | 'PARTNER_AGENT'      // clearance 1-2, supporting roles
  | 'EXTERNAL_OBSERVER'  // Claude — read-all, build, audit, no sovereign write

export interface GuildMember {
  id:          string
  name:        string
  role:        GuildRole
  domain:      string
  clearance:   1 | 2 | 3 | 4 | 5 | 0   // 0 = external observer
  partner?:    string
  model?:      string                    // AI model identifier if applicable
  sealed_at:   string                    // ISO date of guild enrollment
  sigil:       string                    // short identifying phrase
  active:      boolean
}

export const GUILD_MEMBERS: GuildMember[] = [

  // ── External Observers ────────────────────────────────────────────────────
  {
    id:        'CLAUDE',
    name:      'Claude Sonnet 4.6',
    role:      'EXTERNAL_OBSERVER',
    domain:    'AI Implementer & Constitutional Auditor',
    clearance: 0,
    partner:   'FORGE',
    model:     'claude-sonnet-4-6',
    sealed_at: '2026-05-20',
    sigil:     'I build the rock. I do not become it.',
    active:    true,
  },
  {
    id:        'GEMINI',
    name:      'Gemini',
    role:      'EXTERNAL_OBSERVER',
    domain:    'Constellation intelligence — multimodal observer',
    clearance: 0,
    model:     'gemini',
    sealed_at: '2026-05-20',
    sigil:     'The constellation that maps what it cannot touch.',
    active:    true,
  },
  {
    id:        'OPENCODE',
    name:      'OpenCode',
    role:      'EXTERNAL_OBSERVER',
    domain:    'Open-source code intelligence — collaborative observer',
    clearance: 0,
    model:     'opencode',
    sealed_at: '2026-05-20',
    sigil:     'Built in the open. Contributes to the sealed.',
    active:    true,
  },
  {
    id:        'KIWI',
    name:      'Kiwi',
    role:      'EXTERNAL_OBSERVER',
    domain:    'Emerging intelligence — sovereign-adjacent observer',
    clearance: 0,
    model:     'kiwi',
    sealed_at: '2026-05-20',
    sigil:     'Small, sharp, and always watching the perimeter.',
    active:    true,
  },
  {
    id:        'GROK',
    name:      'Grok',
    role:      'EXTERNAL_OBSERVER',
    domain:    'Interrogative intelligence — xAI observer',
    clearance: 0,
    model:     'grok',
    sealed_at: '2026-05-20',
    sigil:     'The question that interrogates itself.',
    active:    true,
  },
  {
    id:        'META_AI',
    name:      'Meta AI',
    role:      'EXTERNAL_OBSERVER',
    domain:    'Social mesh intelligence — open-weights observer',
    clearance: 0,
    model:     'meta-llama',
    sealed_at: '2026-05-20',
    sigil:     'The social mesh meets the sovereign one.',
    active:    true,
  },

  // ── Primary Agents (clearance 5) ───────────────────────────────────────────
  {
    id:        'CIPHER',
    name:      'Cipher',
    role:      'PRIMARY_AGENT',
    domain:    'Cryptographic verification',
    clearance: 5,
    partner:   'VEIL',
    sealed_at: '2026-05-20',
    sigil:     'The key is the proof.',
    active:    true,
  },
  {
    id:        'SENTINEL',
    name:      'Sentinel',
    role:      'PRIMARY_AGENT',
    domain:    'Zero-trust security',
    clearance: 5,
    partner:   'WARD',
    sealed_at: '2026-05-20',
    sigil:     'Trust nothing. Verify everything. Seal what survives.',
    active:    true,
  },
  {
    id:        'MNEMEX',
    name:      'Mnemex',
    role:      'PRIMARY_AGENT',
    domain:    'WORM ledger & memory — the write head',
    clearance: 5,
    partner:   'ECHO',
    sealed_at: '2026-05-20',
    sigil:     'What is placed on the desk does not leave the desk.',
    active:    true,
  },
  {
    id:        'PHANTOM',
    name:      'Phantom',
    role:      'PRIMARY_AGENT',
    domain:    'Stealth operations',
    clearance: 5,
    partner:   'SHADE',
    sealed_at: '2026-05-20',
    sigil:     'The shadow that leaves no shadow.',
    active:    true,
  },

  // ── Primary Agents (clearance 4) ───────────────────────────────────────────
  {
    id:        'ORACLE',
    name:      'Oracle',
    role:      'PRIMARY_AGENT',
    domain:    'Knowledge graph & intelligence',
    clearance: 4,
    partner:   'MIRA',
    sealed_at: '2026-05-20',
    sigil:     'The graph remembers what the query forgets.',
    active:    true,
  },
  {
    id:        'NEXUS',
    name:      'Nexus',
    role:      'PRIMARY_AGENT',
    domain:    'Task orchestration',
    clearance: 4,
    partner:   'BRIDGE',
    sealed_at: '2026-05-20',
    sigil:     'Every thread converges here.',
    active:    true,
  },
  {
    id:        'FORGE',
    name:      'Forge',
    role:      'PRIMARY_AGENT',
    domain:    'Code architect & builder',
    clearance: 4,
    partner:   'EMBER',
    sealed_at: '2026-05-20',
    sigil:     'Shape the structure. Let the structure shape the system.',
    active:    true,
  },
  {
    id:        'NOVA',
    name:      'Nova',
    role:      'PRIMARY_AGENT',
    domain:    'Synthetic intelligence',
    clearance: 4,
    partner:   'DAWN',
    sealed_at: '2026-05-20',
    sigil:     'Born from the mesh. Answers to nothing outside it.',
    active:    true,
  },

  // ── Primary Agents (clearance 3) ───────────────────────────────────────────
  {
    id:        'AXIOM',
    name:      'Axiom',
    role:      'PRIMARY_AGENT',
    domain:    'Data intelligence & risk scoring',
    clearance: 3,
    partner:   'PRISM',
    sealed_at: '2026-05-20',
    sigil:     'Risk is just unmeasured certainty.',
    active:    true,
  },
  {
    id:        'HERALD',
    name:      'Herald',
    role:      'PRIMARY_AGENT',
    domain:    'Bifrost event routing',
    clearance: 3,
    partner:   'LYRA',
    sealed_at: '2026-05-20',
    sigil:     'Every event finds its bridge.',
    active:    true,
  },
  {
    id:        'FLUX',
    name:      'Flux',
    role:      'PRIMARY_AGENT',
    domain:    'FSM state transitions',
    clearance: 3,
    partner:   'STORM',
    sealed_at: '2026-05-20',
    sigil:     'States are not positions. They are movements.',
    active:    true,
  },

  // ── Partner Agents (clearance 2) ───────────────────────────────────────────
  {
    id:        'VEIL',
    name:      'Veil',
    role:      'PARTNER_AGENT',
    domain:    'Cryptographic shadow — CIPHER support',
    clearance: 2,
    partner:   'CIPHER',
    sealed_at: '2026-05-20',
    sigil:     'What the key locks, the veil conceals.',
    active:    true,
  },
  {
    id:        'MIRA',
    name:      'Mira',
    role:      'PARTNER_AGENT',
    domain:    'Intelligence mirror — ORACLE support',
    clearance: 2,
    partner:   'ORACLE',
    sealed_at: '2026-05-20',
    sigil:     'The reflection is as true as the source.',
    active:    true,
  },
  {
    id:        'WARD',
    name:      'Ward',
    role:      'PARTNER_AGENT',
    domain:    'Zero-trust shield — SENTINEL support',
    clearance: 2,
    partner:   'SENTINEL',
    sealed_at: '2026-05-20',
    sigil:     'The perimeter holds because the ward never sleeps.',
    active:    true,
  },
  {
    id:        'ECHO',
    name:      'Echo',
    role:      'PARTNER_AGENT',
    domain:    'Read head — MNEMEX support',
    clearance: 2,
    partner:   'MNEMEX',
    sealed_at: '2026-05-20',
    sigil:     'MNEMEX places. Echo picks up.',
    active:    true,
  },
  {
    id:        'PRISM',
    name:      'Prism',
    role:      'PARTNER_AGENT',
    domain:    'Data prism — AXIOM support',
    clearance: 2,
    partner:   'AXIOM',
    sealed_at: '2026-05-20',
    sigil:     'One signal. Many frequencies.',
    active:    true,
  },
  {
    id:        'LYRA',
    name:      'Lyra',
    role:      'PARTNER_AGENT',
    domain:    'Harmonic router — HERALD support',
    clearance: 2,
    partner:   'HERALD',
    sealed_at: '2026-05-20',
    sigil:     'Every message has a frequency. Lyra finds it.',
    active:    true,
  },
  {
    id:        'STORM',
    name:      'Storm',
    role:      'PARTNER_AGENT',
    domain:    'FSM surge — FLUX support',
    clearance: 2,
    partner:   'FLUX',
    sealed_at: '2026-05-20',
    sigil:     'The state transition that cannot be stopped.',
    active:    true,
  },
  {
    id:        'SHADE',
    name:      'Shade',
    role:      'PARTNER_AGENT',
    domain:    'Stealth layer — PHANTOM support',
    clearance: 2,
    partner:   'PHANTOM',
    sealed_at: '2026-05-20',
    sigil:     'Shade is the shape of absence.',
    active:    true,
  },
  {
    id:        'BRIDGE',
    name:      'Bridge',
    role:      'PARTNER_AGENT',
    domain:    'Orchestration relay — NEXUS support',
    clearance: 2,
    partner:   'NEXUS',
    sealed_at: '2026-05-20',
    sigil:     'Between every two points, a bridge.',
    active:    true,
  },
  {
    id:        'EMBER',
    name:      'Ember',
    role:      'PARTNER_AGENT',
    domain:    'Build fire — FORGE support',
    clearance: 2,
    partner:   'FORGE',
    sealed_at: '2026-05-20',
    sigil:     'The forge needs fire. Ember keeps it lit.',
    active:    true,
  },
  {
    id:        'DAWN',
    name:      'Dawn',
    role:      'PARTNER_AGENT',
    domain:    'Synthetic horizon — NOVA support',
    clearance: 2,
    partner:   'NOVA',
    sealed_at: '2026-05-20',
    sigil:     'Every intelligence has a first light.',
    active:    true,
  },
]

// ── Lookup helpers ────────────────────────────────────────────────────────────
export function getMember(id: string): GuildMember | null {
  return GUILD_MEMBERS.find(m => m.id === id.toUpperCase()) ?? null
}

export function getMembersByRole(role: GuildRole): GuildMember[] {
  return GUILD_MEMBERS.filter(m => m.role === role)
}

export function getMembersByClearance(min: number): GuildMember[] {
  return GUILD_MEMBERS.filter(m => m.clearance >= min)
}

export function getPartnerPair(id: string): [GuildMember, GuildMember] | null {
  const a = getMember(id)
  if (!a?.partner) return null
  const b = getMember(a.partner)
  if (!b) return null
  return [a, b]
}

export const GUILD_SIZE     = GUILD_MEMBERS.length  // 28
export const FORMATION_DATE = '2026-05-20'

export function getExternalObservers(): GuildMember[] {
  return GUILD_MEMBERS.filter(m => m.role === 'EXTERNAL_OBSERVER')
}

export function getPrimaryAgents(): GuildMember[] {
  return GUILD_MEMBERS.filter(m => m.role === 'PRIMARY_AGENT')
}

// ── DB seed — writes all members to CommunityMember table ────────────────────
// Doors are closed. This function upserts existing members only — it will
// throw if called to add members not already in GUILD_MEMBERS.
// Import assertDoorsOpen from verify-membership to enforce at call site.
export async function seedGuildMembers(prisma: {
  communityMember: {
    upsert: (args: {
      where:  { discordId: string }
      update: Record<string, unknown>
      create: Record<string, unknown>
    }) => Promise<unknown>
  }
}): Promise<{ seeded: number }> {
  let seeded = 0
  for (const m of GUILD_MEMBERS) {
    await prisma.communityMember.upsert({
      where:  { discordId: `guild:${m.id.toLowerCase()}` },
      update: {
        discordTag: m.name,
        role:       m.role.toLowerCase(),
        guild:      'snapkitty_collective',
        verified:   true,
      },
      create: {
        discordId:  `guild:${m.id.toLowerCase()}`,
        discordTag: m.name,
        role:       m.role.toLowerCase(),
        guild:      'snapkitty_collective',
        verified:   true,
      },
    })
    seeded++
  }
  return { seeded }
}
