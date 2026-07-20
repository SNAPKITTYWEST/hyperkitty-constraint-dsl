/**
 * uipath_bridge.mjs — UiPath ↔ BOB Sovereign Bridge
 *
 * Hackathon: hackathon26_1025
 * Stack:
 *   UiPath Document Understanding  → extract fields from financial docs
 *   BOB Retrieval                  → validate against sovereign knowledge
 *   UiPath Orchestrator            → queue verified items for robot execution
 *
 * No LLM in the decision path. BOB either confirms with evidence or SILENCE.
 * Every decision WORM-sealed.
 */

import { createHash } from 'node:crypto'
import { readFileSync, appendFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// ── Config ────────────────────────────────────────────────────────────────────

const __dir = path.dirname(fileURLToPath(import.meta.url))
const ENV   = loadEnv()

const ORCH_BASE   = ENV.UIPATH_ORCHESTRATOR_URL  // https://cloud.uipath.com/snapkittycllective/portal_/orchestrator_
const DU_BASE     = ENV.UIPATH_DU_URL            // https://cloud.uipath.com/snapkittycllective/portal_/du_
const AGENT_BASE  = ENV.UIPATH_AGENT_URL         // https://cloud.uipath.com/snapkittycllective/portal_/agenthub_

const ORCH_TOKEN  = ENV.UIPATH_ORCHESTRATOR_TOKEN
const AGENT_TOKEN = ENV.UIPATH_CONVERSATIONAL_AGENTS_TOKEN
const DU_TOKEN    = ENV.UIPATH_DOCUMENT_UNDERSTANDING_TOKEN
const ECX_TOKEN   = ENV.UIPATH_ENTERPRISE_CONTEXT_TOKEN
const SOL_TOKEN   = ENV.UIPATH_AUTOMATION_SOLUTIONS_TOKEN
const WORM_PATH       = path.join(__dir, '.uipath-bridge-worm.jsonl')
const BOB_SCRIPT      = path.join(__dir, 'bob_retrieval.py')
const SILENCE_SCORE   = 0.42

// ── Env loader ────────────────────────────────────────────────────────────────

function loadEnv () {
  const base = path.resolve(__dir, '../..')   // sovereign-router → packages → DEVFLOW-FINANCE
  const env  = {}
  for (const file of ['.env', 'collectivekitty/.env.local']) {
    const p = path.join(base, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const [k, ...rest] = trimmed.split('=')
      env[k.trim()] = rest.join('=').trim()
    }
  }
  return env
}

// ── WORM seal ─────────────────────────────────────────────────────────────────

function wormSeal (event) {
  event.ts = new Date().toISOString()
  let prev = ''
  if (existsSync(WORM_PATH)) {
    const lines = readFileSync(WORM_PATH, 'utf8').split('\n').filter(Boolean)
    if (lines.length) prev = JSON.parse(lines.at(-1)).seal ?? ''
  }
  const payload = JSON.stringify(event, Object.keys(event).sort())
  const seal    = createHash('sha256').update(prev + payload).digest('hex')
  event.prev    = prev.slice(0, 16)
  event.seal    = seal
  appendFileSync(WORM_PATH, JSON.stringify(event) + '\n', 'utf8')
  return seal
}

// ── UiPath helpers ────────────────────────────────────────────────────────────

async function uipathFetch (base, path, { token = ORCH_TOKEN, method = 'GET', body } = {}) {
  const url = `${base}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`UiPath ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// ── Document Understanding ────────────────────────────────────────────────────

/**
 * Submit a document to UiPath Document Understanding for extraction.
 * Returns structured fields extracted by the DU pipeline.
 */
export async function extractDocument (documentPath, documentType = 'Invoice') {
  console.log(`[BRIDGE] Submitting to Document Understanding: ${documentType}`)

  // Upload document and start extraction job
  const job = await uipathFetch(DU_BASE, '/api/framework/projects/default/extractors/mlExtractor/extraction', {
    token:  DU_TOKEN,
    method: 'POST',
    body:   { documentPath, documentType },
  })

  wormSeal({
    event:        'DU_EXTRACTION_START',
    documentType,
    jobId:        job.jobId ?? job.id,
  })

  return job
}

/**
 * Get extraction results from a completed DU job.
 */
export async function getExtractionResult (jobId) {
  const result = await uipathFetch(DU_BASE, `/api/framework/projects/default/extractionResults/${jobId}`, {
    token: DU_TOKEN,
  })
  console.log(`[BRIDGE] DU result for job ${jobId}: ${result.status}`)
  return result
}

// ── BOB validation layer ──────────────────────────────────────────────────────

/**
 * Run BOB retrieval on an extracted document field set.
 * Returns { verdict: 'EVIDENCE'|'SILENCE', score, seal }.
 */
export async function validateWithBOB (extractedFields) {
  const { spawnSync } = await import('node:child_process')

  // Construct a natural-language query from the extracted fields
  const query = buildValidationQuery(extractedFields)
  console.log(`[BRIDGE] BOB validation query: "${query.slice(0, 80)}..."`)

  const result = spawnSync('python', [BOB_SCRIPT, '--query', query, '--no-tavily'], {
    encoding: 'utf8',
    timeout:  30_000,
  })

  const output   = result.stdout + result.stderr
  const scoreMatch = output.match(/Top score:\s*([\d.]+)/)
  const sealMatch  = output.match(/seal:\s*([0-9a-f]{16})/)
  const score    = scoreMatch ? parseFloat(scoreMatch[1]) : 0
  const verdict  = score >= SILENCE_SCORE ? 'EVIDENCE' : 'SILENCE'

  const seal = wormSeal({
    event:   'BOB_VALIDATION',
    query:   query.slice(0, 100),
    score,
    verdict,
    bobSeal: sealMatch?.[1] ?? '',
  })

  console.log(`[BRIDGE] BOB verdict: ${verdict}  score: ${score.toFixed(3)}  seal: ${seal.slice(0, 16)}`)
  return { verdict, score, seal, query }
}

function buildValidationQuery (fields) {
  const parts = []
  if (fields.vendor)      parts.push(`vendor ${fields.vendor}`)
  if (fields.amount)      parts.push(`amount ${fields.amount}`)
  if (fields.accountNo)   parts.push(`ACH account ${fields.accountNo}`)
  if (fields.routingNo)   parts.push(`routing ${fields.routingNo}`)
  if (fields.invoiceNo)   parts.push(`invoice ${fields.invoiceNo}`)
  if (fields.docType)     parts.push(`document type ${fields.docType}`)
  return parts.length
    ? `Is this transaction policy-compliant? ${parts.join(', ')}`
    : 'validate sovereign financial document policy compliance'
}

// ── Orchestrator queue ────────────────────────────────────────────────────────

/**
 * Push a verified item into a UiPath Orchestrator queue for robot execution.
 * Only called when BOB verdict = EVIDENCE.
 */
export async function queueVerifiedItem (queueName, itemData, bobResult) {
  const item = await uipathFetch(ORCH_BASE, '/odata/Queues/UiPathODataSvc.AddQueueItem', {
    method: 'POST',
    body: {
      itemData: {
        Name:     queueName,
        Priority: 'Normal',
        SpecificContent: {
          ...itemData,
          bob_score:   bobResult.score,
          bob_seal:    bobResult.seal,
          bob_verdict: bobResult.verdict,
          verified_at: new Date().toISOString(),
        }
      }
    }
  })

  wormSeal({
    event:     'ORCHESTRATOR_QUEUE',
    queueName,
    itemId:    item.Id ?? item.id,
    bobScore:  bobResult.score,
  })

  console.log(`[BRIDGE] Queued item ${item.Id ?? item.id} in ${queueName}`)
  return item
}

/**
 * Push a SILENCE event to the human review queue.
 * Called when BOB verdict = SILENCE — no automation proceeds.
 */
export async function queueForHumanReview (queueName, itemData, bobResult) {
  const item = await uipathFetch(ORCH_BASE, '/odata/Queues/UiPathODataSvc.AddQueueItem', {
    method: 'POST',
    body: {
      itemData: {
        Name:     `${queueName}-HumanReview`,
        Priority: 'High',
        SpecificContent: {
          ...itemData,
          bob_score:   bobResult.score,
          bob_seal:    bobResult.seal,
          bob_verdict: 'SILENCE',
          reason:      'BOB could not verify against sovereign knowledge — human review required',
          flagged_at:  new Date().toISOString(),
        }
      }
    }
  })

  wormSeal({
    event:    'HUMAN_REVIEW_QUEUE',
    queueName,
    itemId:   item.Id ?? item.id,
    reason:   'BOB SILENCE',
  })

  console.log(`[BRIDGE] ⚠ SILENCE — human review queued (item ${item.Id ?? item.id})`)
  return item
}

// ── Agent Conversation ────────────────────────────────────────────────────────

/**
 * Send a message through the UiPath Agent Conversation API.
 * Uses the agent token (separate from orchestrator).
 */
export async function agentMessage (conversationId, message) {
  const response = await uipathFetch(AGENT_BASE, `/api/v1/conversations/${conversationId}/messages`, {
    token:  AGENT_TOKEN,
    method: 'POST',
    body:   { content: message, role: 'user' }
  })

  wormSeal({
    event:          'AGENT_MESSAGE',
    conversationId,
    messagePreview: message.slice(0, 80),
  })

  return response
}

// ── Full pipeline ─────────────────────────────────────────────────────────────

/**
 * End-to-end sovereign document processing pipeline:
 *   1. Extract fields with UiPath DU
 *   2. Validate with BOB (no LLM, no hallucination)
 *   3. Route: EVIDENCE → execution queue, SILENCE → human review
 */
export async function processDocument (documentPath, queueName, documentType = 'Invoice') {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  SOVEREIGN DOCUMENT PIPELINE`)
  console.log(`  doc: ${documentPath}`)
  console.log(`${'═'.repeat(60)}\n`)

  // Step 1 — Document Understanding
  const job    = await extractDocument(documentPath, documentType)
  const result = await getExtractionResult(job.jobId ?? job.id)

  // Step 2 — BOB validation
  const bobResult = await validateWithBOB(result.fields ?? {})

  // Step 3 — Route
  if (bobResult.verdict === 'EVIDENCE') {
    await queueVerifiedItem(queueName, result.fields ?? {}, bobResult)
    console.log(`\n✓ VERIFIED  seal: ${bobResult.seal.slice(0, 16)}`)
  } else {
    await queueForHumanReview(queueName, result.fields ?? {}, bobResult)
    console.log(`\n⚠ SILENCE   — no automation. Human review required.`)
  }

  console.log(`${'═'.repeat(60)}\n`)
  return { verdict: bobResult.verdict, seal: bobResult.seal }
}

// ── Dry run ───────────────────────────────────────────────────────────────────

if (process.argv[2] === '--dry-run') {
  console.log('\n[BRIDGE] DRY RUN — UiPath ↔ BOB Sovereign Bridge')
  console.log(`  UIPATH_CLOUD_URL:   ${ORCH_BASE || 'MISSING — set UIPATH_ORCHESTRATOR_URL in .env'}`)
  console.log(`  ORCHESTRATOR:       ${ORCH_TOKEN  ? '✓ set' : '✗ MISSING'}`)
  console.log(`  CONVERSATIONAL_AI:  ${AGENT_TOKEN ? '✓ set' : '✗ MISSING'}`)
  console.log(`  DOCUMENT_UNDER.:    ${DU_TOKEN    ? '✓ set' : '✗ MISSING'}`)
  console.log(`  ENTERPRISE_CTX:     ${ECX_TOKEN   ? '✓ set' : '✗ MISSING'}`)
  console.log(`  AUTOMATION_SOL.:    ${SOL_TOKEN   ? '✓ set' : '✗ MISSING'}`)
  console.log(`  BOB_SCRIPT:         ${existsSync(BOB_SCRIPT) ? '✓' : '✗ not found'}`)
  console.log(`  WORM:               ${WORM_PATH}`)
  console.log(`  SILENCE_THRESHOLD:  ${SILENCE_SCORE}`)
}
