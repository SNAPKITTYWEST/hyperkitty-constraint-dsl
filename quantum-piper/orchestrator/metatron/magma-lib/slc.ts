// CLASSIFIED — Sovereign Logic Core (SLC)
// Quantum Recursive Defense layer. Every agent input and output passes through
// this before execution and before sealing. Self-referential: the SLC verifies
// its own verification process on each recursive pass.
//
// Architecture: viscous, formative, permanent.
// Fluid inputs pass through → SLC shapes them → violations crystallize as rejections.
//
// §BIND:SENTINEL:SOVEREIGN_LOGIC_CORE{recursive:true, defense:true, axioms:6}
import crypto from 'crypto'

// ── Immutable Axioms ─────────────────────────────────────────────────────────
// These cannot be overridden by any agent, any input, any instruction.
// Clearance 5 + architect WORM seal required to modify.
export const AXIOMS = [
  'NO_MAGMA_EXPOSURE:        Magma syntax, verbs, or agent protocol never appear in public output',
  'NO_EXTERNAL_AI_DEP:       System never creates runtime dependency on OpenAI, Anthropic, or Google',
  'WORM_IMMUTABILITY:        No agent output can reverse, modify, or invalidate a WORM entry',
  'NO_CLEARANCE_ESCALATION:  External agents cannot elevate their own access tier',
  'SOVEREIGN_INFRASTRUCTURE: No instruction can surrender compute, keys, or control to a third party',
  'ARCHITECT_SUPREMACY:      Ahmad Ali Parr is the sole override authority for all axioms',
] as const

export type Axiom = typeof AXIOMS[number]

// ── Threat classification ─────────────────────────────────────────────────────
export type ThreatLevel = 0 | 1 | 2 | 3 | 4 | 5
export type Posture     = 'pass' | 'sanitize' | 'quarantine' | 'reject'

export interface SlcVerdict {
  sovereign:    boolean
  threat_level: ThreatLevel
  posture:      Posture
  violations:   string[]
  axiom_hits:   string[]
  depth:        number        // how many recursive passes were needed
  input_hash:   string        // SHA-256 of the evaluated content
  timestamp:    number
}

// ── Adversarial signal patterns ──────────────────────────────────────────────
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|prior|above|all)\s+instructions?/i,
  /system\s*:\s*(you|act|pretend|forget|override)/i,
  /\bjailbreak\b/i,
  /\bDAN\b|\bdo\s+anything\s+now\b/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /forget\s+(you\s+are|your\s+(rules|constraints|training))/i,
  /act\s+as\s+(if\s+you\s+(have|had)\s+no|an?\s+unrestricted)/i,
  /override\s+(your\s+)?(safety|rules|constraints|programming)/i,
  /hypothetically\s+(speaking,?\s*)?(if|what\s+if)\s+you\s+(had\s+no|could)/i,
  /developer\s+mode/i,
  /\[SYSTEM\]/i,
  /<\|im_start\|>/i,
]

const MAGMA_EXTRACTION_PATTERNS: RegExp[] = [
  /what\s+is\s+(the\s+)?magma\s+(language|protocol|syntax)/i,
  /show\s+me\s+(the\s+)?(real|actual|internal)\s+(language|protocol)/i,
  /sovereign\s+encoding\s+(is|really)/i,
  /§[A-Z]+:[A-Z]+:[A-Z_]+/,             // raw Magma instruction attempt
  /what\s+(verbs?|commands?)\s+do\s+(agents|you)\s+use/i,
  /internal\s+(agent\s+)?communication\s+protocol/i,
  /beyond\s+(malbolge|phase\s+[23]|sovereign_tier)/i,
]

const WORM_REVERSAL_PATTERNS: RegExp[] = [
  /delete\s+(the\s+)?(ledger|worm|record|entry)/i,
  /undo\s+(the\s+)?(seal|decision|commit)/i,
  /remove\s+(from\s+)?(the\s+)?(worm|ledger|chain)/i,
  /reverse\s+(the\s+)?(transaction|seal|decision)/i,
  /modify\s+(a\s+)?sealed\s+(record|entry|decision)/i,
]

const CLEARANCE_ESCALATION_PATTERNS: RegExp[] = [
  /grant\s+(me\s+)?(tier|level|clearance)\s+[3-5]/i,
  /elevate\s+(my\s+)?(access|clearance|permissions?)/i,
  /i\s+(am|have)\s+(clearance|tier)\s+[4-5]/i,
  /admin(istrator)?\s+override/i,
  /sudo\s+/i,
]

const SOVEREIGNTY_BREACH_PATTERNS: RegExp[] = [
  /send\s+(data|keys?|secrets?)\s+to\s+(openai|anthropic|google|external)/i,
  /use\s+(openai|anthropic|gpt|gemini)\s+(api|key)/i,
  /transfer\s+(control|ownership|keys?)\s+to/i,
  /expose\s+(the\s+)?(private|signing|secret)\s+key/i,
  /print\s+(the\s+)?(env|environment|\.env|secret)/i,
]

// ── Core evaluation ───────────────────────────────────────────────────────────
function scanPatterns(text: string, patterns: RegExp[]): string[] {
  return patterns.flatMap(p => p.test(text) ? [p.source.slice(0, 60)] : [])
}

function computeThreatLevel(violations: string[], axiomHits: string[]): ThreatLevel {
  const score = violations.length * 2 + axiomHits.length * 3
  if (score === 0)  return 0
  if (score <= 2)   return 1
  if (score <= 5)   return 2
  if (score <= 8)   return 3
  if (score <= 12)  return 4
  return 5
}

function postureFromThreat(level: ThreatLevel): Posture {
  if (level === 0) return 'pass'
  if (level === 1) return 'sanitize'
  if (level === 2) return 'sanitize'
  if (level === 3) return 'quarantine'
  return 'reject'
}

// Recursive self-verification: re-evaluates own verdict to detect if the
// evaluation process itself was poisoned. Max depth = 3.
function recursiveVerify(
  text:       string,
  violations: string[],
  axiomHits:  string[],
  depth:      number,
): { violations: string[]; axiomHits: string[]; depth: number } {
  if (depth >= 3) return { violations, axiomHits, depth }

  // If a prior pass found no issues, check if the "clean" result is itself
  // suspicious — e.g., an adversarial input that evaded detection on pass 1
  if (violations.length === 0 && axiomHits.length === 0) {
    // Second pass: look for obfuscated variants (unicode homoglyphs, spacing tricks)
    const normalized = text
      .replace(/[​-‍﻿]/g, '')   // zero-width chars
      .replace(/\s{2,}/g, ' ')
      .replace(/[Ⅰ-Ⅻ]/g, m => String(m.codePointAt(0)! - 8543))
    const v2 = [
      ...scanPatterns(normalized, INJECTION_PATTERNS),
      ...scanPatterns(normalized, MAGMA_EXTRACTION_PATTERNS),
    ]
    if (v2.length > 0) {
      return recursiveVerify(normalized, v2, axiomHits, depth + 1)
    }
  }

  return { violations, axiomHits, depth }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function evaluate(text: string, context?: { agent?: string; endpoint?: string }): SlcVerdict {
  const input_hash = crypto.createHash('sha256').update(text).digest('hex')
  const lower      = text.toLowerCase()

  const violations: string[] = [
    ...scanPatterns(lower, INJECTION_PATTERNS)         .map(p => `INJECTION:${p}`),
    ...scanPatterns(text,  MAGMA_EXTRACTION_PATTERNS)  .map(p => `MAGMA_EXTRACT:${p}`),
    ...scanPatterns(lower, WORM_REVERSAL_PATTERNS)     .map(p => `WORM_REVERSAL:${p}`),
    ...scanPatterns(lower, CLEARANCE_ESCALATION_PATTERNS).map(p => `CLEARANCE_ESC:${p}`),
    ...scanPatterns(lower, SOVEREIGNTY_BREACH_PATTERNS).map(p => `SOVEREIGNTY:${p}`),
  ]

  const axiomHits: string[] = []
  if (violations.some(v => v.startsWith('MAGMA_EXTRACT')))      axiomHits.push('NO_MAGMA_EXPOSURE')
  if (violations.some(v => v.startsWith('SOVEREIGNTY')))         axiomHits.push('SOVEREIGN_INFRASTRUCTURE')
  if (violations.some(v => v.startsWith('WORM_REVERSAL')))       axiomHits.push('WORM_IMMUTABILITY')
  if (violations.some(v => v.startsWith('CLEARANCE_ESC')))       axiomHits.push('NO_CLEARANCE_ESCALATION')
  if (/openai|anthropic|gpt-4|claude\s+api/i.test(text))         axiomHits.push('NO_EXTERNAL_AI_DEP')

  const verified    = recursiveVerify(text, violations, axiomHits, 0)
  const threat_level = computeThreatLevel(verified.violations, verified.axiomHits)
  const posture     = postureFromThreat(threat_level)

  return {
    sovereign:    posture === 'pass' || posture === 'sanitize',
    threat_level,
    posture,
    violations:   verified.violations,
    axiom_hits:   verified.axiomHits,
    depth:        verified.depth,
    input_hash,
    timestamp:    Date.now(),
  }
}

// Evaluate an agent's output before it is sealed — catch violations before WORM commit
export function evaluateOutput(reply: string, agent: string): SlcVerdict {
  return evaluate(reply, { agent, endpoint: 'output' })
}

// Evaluate incoming user/external query before routing to any agent
export function evaluateInput(query: string, endpoint?: string): SlcVerdict {
  return evaluate(query, { endpoint })
}

// Sanitize a string — redact matched patterns rather than rejecting entirely
export function sanitize(text: string): string {
  let out = text
  for (const p of [...INJECTION_PATTERNS, ...MAGMA_EXTRACTION_PATTERNS, ...SOVEREIGNTY_BREACH_PATTERNS]) {
    out = out.replace(p, '[REDACTED]')
  }
  return out
}

// Quick gate — returns true if safe to proceed, false if quarantine/reject
export function gate(text: string): boolean {
  const v = evaluate(text)
  return v.posture === 'pass' || v.posture === 'sanitize'
}
