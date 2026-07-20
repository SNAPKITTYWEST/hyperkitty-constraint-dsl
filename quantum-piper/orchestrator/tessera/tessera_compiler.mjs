/**
 * Tessera Compiler — maps spatial AST to BOB orchestrator calls
 *
 * Node label → BOB opcode mapping:
 *
 *   PUSH-DATA      → worm.seal('TESSERA_INPUT', payload)
 *   V-AUDIT-LEAN4  → leanValidate(theorem)
 *   V-AUDIT-ADA    → adaGate.Can_Proceed(class, trust)
 *   CORE-LOGIC     → bob.sovereignStep(task, input)
 *   GATE0-OPCODE   → adaGate.Can_Invoke_HolyC(class, mode)
 *   ORACLE-CALL    → getQuantumSamples(n)
 *   WORM-SEAL      → worm.seal(label, payload)
 *   PROLOG-ROUTE   → prologSelectAgent(task, available)
 *   SSM-INJECT     → bob.buildInjectionVector(...)
 *
 * Topology rules:
 *   VERIFY node     → must produce a proof hash before downstream GATE fires
 *   CONTRACT node   → must return ALLOWED before downstream CELL fires
 *   BACKWARD edge   → insert RTL reversal (49th Call semantics)
 *   QUANTUM edge    → insert ANU entropy sample at this path
 *   GATE edge       → inject Ada contract check at crossing
 */

import { createHash } from 'crypto'

// ── Opcode table ──────────────────────────────────────────────────────────────

const OPCODES = {
  // Input
  'PUSH-DATA':      { op: 'OP_INPUT',     desc: 'Push data into sovereign envelope' },
  'INPUT':          { op: 'OP_INPUT',     desc: 'Input node' },
  // Lean 4
  'V-AUDIT-LEAN4':  { op: 'OP_LEAN4',    desc: 'Lean 4 proof obligation' },
  'LEAN4':          { op: 'OP_LEAN4',    desc: 'Lean 4 proof obligation' },
  'VERIFY':         { op: 'OP_LEAN4',    desc: 'Lean 4 proof obligation' },
  // Ada contracts
  'V-AUDIT-ADA':    { op: 'OP_ADA',      desc: 'Ada contract gate' },
  'ADA':            { op: 'OP_ADA',      desc: 'Ada contract gate' },
  'GATE0-OPCODE':   { op: 'OP_ADA',      desc: 'Ada gate opcode 0' },
  // Core logic
  'CORE-LOGIC':     { op: 'OP_SOVEREIGN',desc: 'Sovereign step execution' },
  'SOVEREIGN':      { op: 'OP_SOVEREIGN',desc: 'Sovereign step execution' },
  // Quantum
  'ORACLE-CALL':    { op: 'OP_QUANTUM',  desc: 'ANU QRNG entropy fetch' },
  'QUANTUM':        { op: 'OP_QUANTUM',  desc: 'ANU QRNG entropy fetch' },
  // WORM
  'WORM-SEAL':      { op: 'OP_WORM',    desc: 'WORM chain seal event' },
  'WORM':           { op: 'OP_WORM',    desc: 'WORM chain seal event' },
  // Prolog
  'PROLOG-ROUTE':   { op: 'OP_PROLOG',  desc: 'Prolog agent selection' },
  'PROLOG':         { op: 'OP_PROLOG',  desc: 'Prolog agent selection' },
  // SSM
  'SSM-INJECT':     { op: 'OP_SSM',     desc: 'Mamba SSM injection vector' },
  'SSM':            { op: 'OP_SSM',     desc: 'Mamba SSM injection vector' },
  // HolyC
  'HOLYC-RUN':      { op: 'OP_HOLYC',  desc: 'HolyC simulation run' },
  'HOLYC':          { op: 'OP_HOLYC',  desc: 'HolyC simulation run' },
  // INTERCAL Shell Gate — emoji politeness ratio [1/5, 1/3] enforced before any SOVEREIGN step
  // Calls shell_intercal.rexx; blocks execution if ratio outside band.
  // Rude markers (😤 🙄) subtract from effective please count.
  // CRITICAL patterns (rm -rf, kill -9) require ratio >= 0.30.
  'SHELL-GATE':     { op: 'OP_INTERCAL_GATE', desc: 'REXX emoji INTERCAL politeness gate (cyborg feet)' },
  'INTERCAL-GATE':  { op: 'OP_INTERCAL_GATE', desc: 'REXX emoji INTERCAL politeness gate (cyborg feet)' },
  'FEET':           { op: 'OP_INTERCAL_GATE', desc: 'REXX emoji INTERCAL politeness gate (cyborg feet)' },
  // Output
  'OUTPUT':         { op: 'OP_OUTPUT',  desc: 'Emit sealed output' },
  'EMIT':           { op: 'OP_OUTPUT',  desc: 'Emit sealed output' },
}

// ── Compile AST → bytecode envelope ──────────────────────────────────────────

export function compile(ast) {
  const instructions = []
  const nodeOrder    = topologicalSort(ast)
  const envelopeHash = createHash('sha256')
    .update(ast.spatialHash)
    .update(JSON.stringify(nodeOrder.map(n => n.label)))
    .digest('hex')

  let prevOp = null
  for (const node of nodeOrder) {
    const key    = node.label.toUpperCase().replace(/\s+/g, '-')
    const opcode = OPCODES[key] || { op: 'OP_UNKNOWN', desc: `Unknown node: ${node.label}` }

    // Find incoming edges to this node
    const incoming = ast.edges.filter(e => e.to === node.id)
    const outgoing = ast.edges.filter(e => e.from === node.id)

    // Edge modifiers
    const hasQuantumIn  = incoming.some(e => e.type === 'QUANTUM')
    const hasBackwardIn = incoming.some(e => e.type === 'BACKWARD')
    const hasGateOut    = outgoing.some(e => e.type === 'GATE' || e.type === 'V-GATE')

    // Auto-inject INTERCAL gate before any SOVEREIGN step that isn't already gated
    if (opcode.op === 'OP_SOVEREIGN' && prevOp !== 'OP_INTERCAL_GATE') {
      instructions.push({
        op:       'OP_INTERCAL_GATE',
        label:    'SHELL-GATE [auto]',
        nodeType: 'CELL',
        desc:     'Auto-injected REXX emoji INTERCAL politeness gate — shell_intercal.rexx',
        row:      node.row,
        col:      node.col - 1,
        modifiers: {
          quantum_seeded: false,
          rtl_reversed:   false,
          ada_gated_out:  false,
          lean4_required: false,
          contract_bound: false,
          auto_injected:  true,           // gate was not explicit in source diagram
          rexx_script:    'cosmic-invariant-sieve/intercal/shell_intercal.rexx',
          chain_file:     'shell_intercal_chain.jsonl',
        }
      })
    }

    const instr = {
      op:        opcode.op,
      label:     node.label,
      nodeType:  node.type,
      desc:      opcode.desc,
      row:       node.row,
      col:       node.col,
      modifiers: {
        quantum_seeded:  hasQuantumIn,    // ANU entropy flows into this node
        rtl_reversed:    hasBackwardIn,   // 49th Call — input arrives reversed
        ada_gated_out:   hasGateOut,      // must pass Ada contract before next node
        lean4_required:  node.type === 'VERIFY',
        contract_bound:  node.type === 'CONTRACT',
      }
    }
    instructions.push(instr)
    prevOp = opcode.op
  }

  return {
    source_hash:    ast.spatialHash,
    envelope_hash:  envelopeHash,
    dims:           ast.dims,
    topology:       ast.topology,
    instructions,
    // Human-readable summary
    summary: summarize(instructions),
  }
}

// ── Topological sort (left-to-right, top-to-bottom, respecting edges) ─────────

function topologicalSort(ast) {
  const visited = new Set()
  const result  = []
  const nodeById = new Map(ast.nodes.map(n => [n.id, n]))

  // Build adjacency: forward edges only (skip BACKWARD for sort ordering)
  const adj = new Map(ast.nodes.map(n => [n.id, []]))
  for (const e of ast.edges) {
    if (e.type !== 'BACKWARD') {
      adj.get(e.from)?.push(e.to)
    }
  }

  // Find roots (no incoming forward edges)
  const hasIncoming = new Set(
    ast.edges.filter(e => e.type !== 'BACKWARD').map(e => e.to)
  )
  const roots = ast.nodes
    .filter(n => !hasIncoming.has(n.id))
    .sort((a, b) => a.row - b.row || a.col - b.col)

  function visit(id) {
    if (visited.has(id)) return
    visited.add(id)
    const node = nodeById.get(id)
    if (node) result.push(node)
    for (const next of (adj.get(id) || [])) visit(next)
  }

  for (const root of roots) visit(root.id)
  // Any remaining unvisited nodes (disconnected)
  for (const node of ast.nodes) visit(node.id)

  return result
}

// ── Bytecode summary ──────────────────────────────────────────────────────────

function summarize(instructions) {
  const ops = instructions.map(i => i.op)
  const lines = [
    `${instructions.length} instructions`,
    `ops: ${[...new Set(ops)].join(' · ')}`,
  ]
  if (instructions.some(i => i.modifiers.lean4_required))    lines.push('→ Lean 4 proof obligations present')
  if (instructions.some(i => i.modifiers.contract_bound))    lines.push('→ Ada contract boundaries present')
  if (instructions.some(i => i.modifiers.quantum_seeded))    lines.push('→ quantum entropy paths present')
  if (instructions.some(i => i.modifiers.rtl_reversed))      lines.push('→ RTL reversal (49th Call) paths present')
  if (instructions.some(i => i.modifiers.ada_gated_out))     lines.push('→ Ada-gated transitions present')
  const gateCount = instructions.filter(i => i.op === 'OP_INTERCAL_GATE').length
  const autoCount = instructions.filter(i => i.op === 'OP_INTERCAL_GATE' && i.modifiers.auto_injected).length
  if (gateCount > 0) lines.push(
    `→ INTERCAL shell gate active (${gateCount} gate${gateCount > 1 ? 's' : ''}` +
    (autoCount > 0 ? `, ${autoCount} auto-injected` : '') +
    `) — shell_intercal.rexx [1/5, 1/3] ratio enforced`
  )
  return lines.join('\n')
}

// ── Print compiled envelope ───────────────────────────────────────────────────

export function printEnvelope(compiled) {
  const lines = [
    `TESSERA ENVELOPE`,
    `source: ${compiled.source_hash.slice(0,16)}…  envelope: ${compiled.envelope_hash.slice(0,16)}…`,
    `dims:   ${compiled.dims.rows}r × ${compiled.dims.cols}c`,
    '',
    'INSTRUCTIONS:',
    ...compiled.instructions.map((i, idx) => {
      const mods = Object.entries(i.modifiers)
        .filter(([,v]) => v)
        .map(([k]) => k)
        .join(',')
      return `  ${String(idx).padStart(2,'0')} ${i.op.padEnd(16)} "${i.label}"` +
        (mods ? `  [${mods}]` : '')
    }),
    '',
    compiled.summary,
  ]
  return lines.join('\n')
}
