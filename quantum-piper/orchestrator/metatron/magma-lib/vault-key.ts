// vault-key.ts — Single source of truth for VAULT_MASTER_SECRET
//
// BORROW CHAIN FIX:
//   Chain 2: Replaces 5 scattered `?? 'dev-worm-key'` fallbacks with a
//            startup-time check. If the env var is missing the module throws
//            immediately — no silent dev-key leaking into production.
//   Chain 1: Exports verifyAgentSeal() — timingSafeEqual HMAC check for
//            receiver-side verification of every AgentWorkSeal.
//
// Import getVaultKey() everywhere VAULT_MASTER_SECRET was used inline.
// Import verifyAgentSeal() at every endpoint that receives a sealed payload.

import crypto from 'crypto'

// ── Startup check — fail loud, fail early ─────────────────────────────────────
const _secret = process.env.VAULT_MASTER_SECRET

if (!_secret && process.env.NODE_ENV === 'production') {
  throw new Error(
    '[VAULT] VAULT_MASTER_SECRET is not set. ' +
    'This env var is required in production. ' +
    'Set it in your .env or Docker compose before starting.'
  )
}

// In development, warn loudly instead of silently using the dev key.
if (!_secret && process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-console
  console.warn(
    '[VAULT] WARNING: VAULT_MASTER_SECRET not set — using ephemeral dev key. ' +
    'ALL HMAC SEALS PRODUCED THIS SESSION ARE INVALID IN PRODUCTION.'
  )
}

// Ephemeral random key for dev — different every boot so it can never accidentally
// match a prod-signed value. Much safer than the static 'dev-worm-key' string.
const DEV_EPHEMERAL_KEY = _secret ?? crypto.randomBytes(32).toString('hex')

export function getVaultKey(): string {
  return DEV_EPHEMERAL_KEY
}

// ── verifyAgentSeal — BORROW CHAIN 1 FIX ─────────────────────────────────────
// Call this at every endpoint that receives an AgentWorkSeal or x-worm-signature.
// Uses timingSafeEqual to prevent timing attacks.
//
// Usage:
//   const ok = verifyAgentSeal({ agent, timestamp, signature }, payload)
//   if (!ok) return res.status(401).json({ error: 'invalid agent seal' })

export interface AgentWorkSeal {
  agent:     string
  timestamp: string
  signature: string
}

export function verifyAgentSeal(seal: AgentWorkSeal, payload: unknown): boolean {
  const expected = crypto
    .createHmac('sha256', getVaultKey())
    .update(`${seal.agent}:${seal.timestamp}:${JSON.stringify(payload)}`)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(seal.signature, 'hex'),
      Buffer.from(expected,       'hex'),
    )
  } catch {
    // Buffer length mismatch — signature is malformed
    return false
  }
}

// ── verifyWormHash — verifies bridge/optimizer/sovereign WORM hash fields ─────
// Same pattern as verifyAgentSeal but for raw hash strings (not AgentWorkSeal objects).
export function verifyWormHash(received: string, message: string): boolean {
  const expected = crypto
    .createHmac('sha256', getVaultKey())
    .update(message)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(received, 'hex'),
      Buffer.from(expected, 'hex'),
    )
  } catch {
    return false
  }
}
