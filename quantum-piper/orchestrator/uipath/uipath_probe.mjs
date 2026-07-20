/**
 * uipath_probe.mjs — discover what's available in the snapkittycllective tenant
 * Run: node uipath_probe.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = path.dirname(fileURLToPath(import.meta.url))

function loadEnv () {
  const base = path.resolve(__dir, '../..')
  const env  = {}
  for (const file of ['.env', 'collectivekitty/.env.local']) {
    const p = path.join(base, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const [k, ...rest] = t.split('=')
      env[k.trim()] = rest.join('=').trim()
    }
  }
  return env
}

const ENV      = loadEnv()
const DU_BASE  = ENV.UIPATH_DU_URL
const ORCH_BASE= ENV.UIPATH_ORCHESTRATOR_URL
const DU_TOKEN = ENV.UIPATH_DOCUMENT_UNDERSTANDING_TOKEN
const ORCH_TOK = ENV.UIPATH_ORCHESTRATOR_TOKEN

async function get (base, path, token) {
  const url = `${base}${path}`
  console.log(`\nGET ${url}`)
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  })
  const text = await res.text()
  console.log(`→ ${res.status}`)
  try { return JSON.parse(text) }
  catch { console.log(text.slice(0, 400)); return null }
}

const ORG   = 'snapkittycllective'
const TENANT= 'portal_'

// Try all identity endpoints — find which one accepts these tokens
const identityUrls = [
  `https://cloud.uipath.com/${ORG}/${TENANT}/identity_/connect/userinfo`,
  `https://cloud.uipath.com/${ORG}/identity_/connect/userinfo`,
  `https://cloud.uipath.com/identity_/connect/userinfo`,
  `https://account.uipath.com/connect/userinfo`,
]

for (const url of identityUrls) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ORCH_TOK}` } })
  const txt = await res.text()
  console.log(`${res.status} ${url}`)
  if (res.status === 200) console.log('  ✓', txt.slice(0,200))
  else console.log(' ', txt.slice(0,100))
}

// Try all the token scopes we have — maybe a different token works
console.log('\n═══ Token fingerprint check ═══')
const tokens = {
  ORCHESTRATOR: ORCH_TOK,
  DU:           DU_TOKEN,
  AGENT:        ENV.UIPATH_CONVERSATIONAL_AGENTS_TOKEN,
  ECX:          ENV.UIPATH_ENTERPRISE_CONTEXT_TOKEN,
  SOL:          ENV.UIPATH_AUTOMATION_SOLUTIONS_TOKEN,
}
for (const [name, tok] of Object.entries(tokens)) {
  const res = await fetch(`https://cloud.uipath.com/${ORG}/${TENANT}/identity_/connect/userinfo`, {
    headers: { Authorization: `Bearer ${tok}` }
  })
  console.log(`${name}: ${res.status}`)
}

// Try the Orchestrator with a JSON-only endpoint that won't serve HTML
console.log('\n═══ Orchestrator JSON probe ═══')
const orchRes = await fetch(`${ORCH_BASE}/api/Status/Get`, {
  headers: { Authorization: `Bearer ${ORCH_TOK}`, Accept: 'application/json' }
})
console.log(`/api/Status/Get → ${orchRes.status}: ${(await orchRes.text()).slice(0,200)}`)
