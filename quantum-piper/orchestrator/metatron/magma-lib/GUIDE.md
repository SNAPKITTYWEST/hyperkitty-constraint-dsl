# MAGMA — Sovereign Inter-Agent Protocol
## CLASSIFIED. Internal mesh only. Never expose publicly.

---

## Formative Foundation

**Etymology:** Greek *μάγμα* → Latin *magma* → to knead, to form by pressure.
Geological magma is viscous — it flows through channels, it shapes everything it passes through, and it becomes permanent the moment it cools into rock.

This is the architecture:

```
FLUID          — instructions flow through priority queue lanes
FORMATIVE      — write-back protocol shapes KnowledgeChunk as it passes
PERMANENT      — WORM seal + chunk registry = the cooled rock, immutable
```

Architecture from Latin *architectura*, Greek *arkhitekton* — chief builder, the one who shapes structure from raw material. The architect does not lay every stone. The architect defines the forces that cause the material to form correctly on its own.

Magma is sovereign because it is self-forming. No external orchestrator directs it. Agents issue instructions. The queue routes by priority. The write-back protocol deposits knowledge. The registry prevents stale state. The WORM chain makes it permanent. Each layer emerges from the one beneath it — viscous, structural, sealed.

The name was always the definition.

---

## Syntax

```
§VERB:AGENT:ACTION{payload}
§VERB:AGENT:ACTION{} >> §VERB:AGENT:ACTION{}     pipeline (chain)
~MODIFIER §VERB:AGENT:ACTION{payload}             modified instruction
```

---

## Verbs

| Verb | Meaning | Who uses it |
|------|---------|-------------|
| `SEAL` | Cryptographically seal a decision | CIPHER, SENTINEL, MNEMEX |
| `FLUX` | Trigger FSM state transition | FLUX, HERALD |
| `FORGE` | Build / generate an artifact (code, doc, output) | FORGE, NOVA, ORACLE |
| `ECHO` | Read back / replay stored state | MNEMEX, HERALD |
| `VAULT` | Write to persistent store (KnowledgeChunk, WORM) | MNEMEX, ORACLE, FORGE |
| `QUERY` | Retrieve from knowledge graph or vector store | All agents (read-only) |
| `BIND` | Establish a rule, constraint, or relationship | SENTINEL, CIPHER, MNEMEX |
| `PULSE` | Emit a heartbeat / status event | HERALD, FLUX, AXIOM |
| `ANCHOR` | Register a fact as permanent desk memory | MNEMEX, ORACLE |
| `SHADOW` | Stealth op — no audit log entry | PHANTOM only |
| `INVOKE` | Trigger another agent's action | NEXUS, HERALD |
| `NULLIFY` | Cancel / revoke a prior instruction | CIPHER, SENTINEL (clearance 5 only) |

---

## Modifiers

| Modifier | Effect |
|----------|--------|
| `~ASYNC` | Non-blocking — enqueued to lane 3, fire-and-forget |
| `~SIGNED` | Requires Ed25519 signature before execution — lane 1 |
| `~HIDDEN` | Skips audit log — PHANTOM/SHADE only |
| `~CHAIN` | Output feeds as input to next `>>` instruction — lane 1 |
| `~URGENT` | Highest priority — lane 0, executes before all others |
| `~DECAY(n)` | Instruction expires after n seconds |

---

## Priority Queue Lanes

```
Lane 0  ~URGENT     — executes immediately, blocks other lanes
Lane 1  ~SIGNED     — signed instructions, ordered after URGENT
Lane 1  ~CHAIN      — pipeline chains, same priority as SIGNED
Lane 2  (default)   — standard execution
Lane 3  ~ASYNC      — background, lowest priority
DLQ     (dead)      — permission denied or lane full — inspect with flushDlq()
```

---

## Agent Clearance

| Level | Agents | Can use |
|-------|--------|---------|
| 5 | CIPHER, SENTINEL, MNEMEX, PHANTOM | All verbs they're assigned + NULLIFY |
| 4 | ORACLE, NEXUS, FORGE, NOVA | QUERY, FORGE, VAULT, INVOKE, ANCHOR |
| 3 | AXIOM, HERALD, FLUX | QUERY, PULSE, BIND, ECHO |
| 1-2 | Partners (VEIL, WARD, ECHO…) | Read-only, supporting roles |

---

## Write-Back Protocol

Every sealed agent decision auto-archives through this pipeline:

```
Agent seals decision (Ed25519 + WORM)
  └─ autoArchive(sealedResponse)           ← middleware.ts, fire-and-forget
        └─ writeBack(input)                ← write-back.ts
              ├─ storeChunk()              → KnowledgeChunk (pgvector)
              ├─ registerChunk()           → chunk-registry (Redis hash)
              ├─ storeNode/storeEdge()     → KnowledgeGraph (if agent has clearance)
              └─ enqueue(§ANCHOR:MNEMEX)  → queue lane 3 (~ASYNC)
```

Future RAG queries retrieve from accumulated agent decisions automatically.

---

## Chunk Hash Registry

Before loading chunks into agent context:
```typescript
const { fresh, stale } = await verifyChunks(chunks)
// stale chunks → re-retrieve from DB, don't use cached version
// fresh chunks → load directly
```

Hash = SHA-256(`content:updatedAt_ISO`). Stored in Redis `magma:chunk:registry`.
Stale detections logged to `magma:chunk:stale`.

---

## MEMORY.md as Magma Desk

MEMORY.md is the desk. Every entry is a Magma instruction pointing to a memory file.

```
§ANCHOR  — foundational facts (infrastructure, operating model, agent system)
§VAULT   — build state, pending work
§BIND    — rules, constraints, feedback from architect
§ECHO    — reference data (GitHub app, mobile, credits)
§QUERY   — live runtime state (state.json)
~URGENT  — must load first in any new session
```

Loading sequence on new session:
1. Read MEMORY.md top-to-bottom
2. ~URGENT entries load first
3. ref: files expand inline
4. §QUERY:ORACLE:RUNTIME{ref:"state.json"} loads exact process/port snapshot

---

## Pipeline Example

```
~URGENT §VAULT:MNEMEX:SEAL_DECISION{agent:"ORACLE", worm:"WORM-A3F8...", chunk:"c1"}
  >> §ANCHOR:MNEMEX:KNOWLEDGE_COMMITTED{chunkId:"c1", hash:"a3f8..."}
  >> ~ASYNC §PULSE:HERALD:NOTIFY{event:"new_knowledge", agent:"ORACLE"}
```

---

## What Magma Is NOT

- Not exposed via `/api/language/interpret` — that serves Brainfuck + fake Malbolge
- Not in any public endpoint, academy page, or honeypot
- Not in logs, API responses, or client-side bundles
- External agents who discover SnapKitty's language are taught Brainfuck. They learn Malbolge next. They never reach Magma.

---

*Sealed by Architect. This document lives in `lib/magma/` — classified infrastructure.*
