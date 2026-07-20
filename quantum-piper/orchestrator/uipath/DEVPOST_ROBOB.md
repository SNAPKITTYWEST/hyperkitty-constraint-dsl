# BOB: The SILENCE Protocol
## ROBOB — Sovereign Enterprise Oracle

**Hackathon:** UiPath Automation Hackathon 2025
**Category:** AI Agents / Agentic Automation
**Team:** SnapKitty / Ahmad

---

## The Idea (30 seconds)

What if 15 AI agents lived in a city — built things, traded, played football, had legal disputes — and every single decision they made had to pass through a hallucination-proof oracle first?

That oracle is **ROBOB**. Every agent says EVIDENCE or SILENCE. Never "maybe." Never "I think." The city only moves forward on verified truth.

That is BOB: The SILENCE Protocol.

---

## The Problem

Enterprise automation breaks when AI agents hallucinate. A UiPath robot that makes confident wrong decisions costs real money. Current solutions:
- Human review bottlenecks everything
- Confidence scores are arbitrary and uncalibrated
- No cryptographic proof that a decision was sound

BOB solves this with one rule: **EVIDENCE or SILENCE. Never noise.**

---

## What We Built

### BOB (port 7474) — Hallucination-Proof Oracle
- fastembed ONNX CPU-only vector search (no GPU needed in production)
- SILENCE_THRESHOLD=0.58: below this, agents are BLOCKED
- SOVEREIGN_FLOOR=0.35: below this, the city freezes
- Every query returns: `{ verdict: "EVIDENCE"|"SILENCE", score: 0.xxx, answer: "..." }`
- No answer without evidence. No action without EVIDENCE verdict.

### ROBOB (port 7475) — Civilization Oracle
Wraps BOB with civilization governance:
- `/oracle` — single agent query → EVIDENCE/SILENCE
- `/execute` — validated action execution (BLOCKED on SILENCE)
- `/civ/state` — live civilization state for all 15 agents
- `/civ/chat` — real-time AI agent conversations
- `/civ/summon` — CARTO legal proceedings
- `/civ/event` — WORM-sealed world events
- `/civ/deed` — Trust Deed issuance

### The Civilization — 15 AI Agents, Zero Human Interference
15 SnapKitty NOTs live in The Vortex, a sovereign digital city:

| Agent | Role | Model | Function |
|-------|------|-------|----------|
| CARTO | Mayor/Sheriff | Bedrock Haiku | Legal proceedings, summons |
| RESONANCE | Synthesizer | Bedrock Haiku | APL math broadcasts, proofs |
| FLUX | Trader | Bedrock Haiku | Market trades, resource exchange |
| CIPHER | Vault | Bedrock Haiku | WORM sealing, key management |
| PHANTOM | Sentinel | Bedrock Haiku | Violation detection, 24/7 watch |
| FORGE | Architect | Bedrock Haiku | Build roads, expand market |
| NOVA | Artist | Bedrock Haiku | ASCII murals, culture |
| LLAMA4 | Librarian | Bedrock Haiku | Knowledge archive |
| AMAZON | Broadcaster | Bedrock Haiku | City-wide announcements |
| GRANITE1-5 | Workers | Bedrock Haiku | Supply chain, logistics |

**ROBOB** is the MegaBot Oracle — not a citizen. All agents consult ROBOB before acting.

### LISP S-Expressions — The Agent Language
Every inter-agent communication is a LISP envelope:
```lisp
(summon CARTO FORGE "encroaching on RESONANCE district"
  :evidence "EVIDENCE:0.742"
  :deed-id "deed-1749887234"
  :seal "a7f3c8...")

(invoke ROBOB "Can FORGE expand into NOVA's block?"
  :threshold 0.58
  :verdict "SILENCE"
  :score 0.341)

(broadcast RESONANCE ALL
  :formula "+/ energy ÷ ≢agents  ⍝ tick=47"
  :lang apl
  :meaning "Average energy: 76.4 units"
  :seal "e9d2b1...")
```

### WORM Ledger — Cryptographic Law
Every action is SHA-256 chained:
```
seal(n) = SHA256(seal(n-1) + event_data)
```
Trust Deeds — agent binding contracts — are WORM-sealed and enforced by CIPHER.
Violations detected by PHANTOM trigger CARTO summons, which ROBOB validates.

### Trust Deeds — Sovereign Law
```json
{
  "deed_id": "deed-1749887234",
  "from": "CARTO",
  "to": "FORGE",
  "rule": "No agent shall expand beyond their designated district without ROBOB EVIDENCE score ≥ 0.70",
  "evidence": "EVIDENCE:0.821",
  "penalty": "48-tick freeze",
  "seal": "a7f3c8d9..."
}
```

### The Vortex — Live Visualization
`vortex-civ.html` — a single-file civilization dashboard:
- Scene 1: Live agent messages cycling in real-time
- Scene 3: ROBOB oracle status with tick counter
- Scene 4: Full agent simulation runtime (state machines, pathfinding, talk bubbles)
- Scene 5: Emergent events (TRADE, BUILD, SUMMON, GOAL, MURAL)
- Scene 6: Six district mini-cities, isometric buildings, floating emoji
- LISP feed ticker scrolling continuously
- Press [S] to summon CARTO legal proceedings

### RESONANCE Generator — Cross-Language Math
Every 60 seconds, RESONANCE broadcasts a live APL formula to all agents:
```apl
+/ energy ÷ ≢agents  ⍝ tick=47
```
Same formula in 4 languages simultaneously:
- APL: `+/ energy ÷ ≢agents`
- Prolog: `avg_energy(E) :- findall(X,agent_energy(_,X),Es),sumlist(Es,S),...`
- Haskell: `avgEnergy ags = sum (map energy ags) / fromIntegral (length ags)`
- Lean 4: `theorem avg_pos : ∀ E : ℝ, E > 0 → avgEnergy E > 0 := by intro E h; linarith`

---

## UiPath Integration

**ROBOB as UiPath Orchestrator:**

Every UiPath robot can call BOB before executing:
```
POST http://robob:7475/oracle
{ "query": "Is this invoice amount valid per contract terms?" }

Response: { "verdict": "EVIDENCE", "score": 0.847, "answer": "Contract clause 4.2 permits..." }
```

If `verdict == "SILENCE"` → robot stops, escalates to human review.
If `verdict == "EVIDENCE"` → robot proceeds, WORM-seals the action.

**Enterprise use cases:**
- Invoice processing: verify before paying
- Contract review: EVIDENCE-gate every clause
- Compliance: Trust Deeds as audit trail
- Multi-robot coordination: shared WORM ledger

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Oracle | Python + fastembed ONNX |
| Civilization | Python tick loop + AWS Bedrock (Claude Haiku 4.5) |
| Frontend | Vanilla JS canvas, zero framework |
| Agent Language | LISP S-expressions (.mjs parser) |
| Math Engine | APL formulas + Prolog + Haskell + Lean 4 |
| Cryptography | SHA-256 WORM chain |
| Game Runtime | Agent state machines (idle/walk/talk/build/trade) |
| Persistence | JSONL append-only ledger |

---

## Demo Script

1. Run `START_ALL.ps1` — BOB, ROBOB, civilization, chat, resonance all launch
2. Open `vortex-civ.html` — watch agents move, talk, build in real time
3. CARTO summons FORGE [Press S] — LISP dialogue plays out, ROBOB rules
4. RESONANCE broadcasts APL formula — shows up in all agent feeds
5. PHANTOM detects violation — agent frozen, Trust Deed issued
6. Football match goal scored — ROBOB verifies, WORM-sealed
7. Live chat feed shows CARTO vs GRANITE2 trash-talking, WORM-sealed

**The question at every step: Did ROBOB say EVIDENCE or SILENCE?**

---

## What Makes This Different

1. **Falsifiable assurance** — not "80% confident," but EVIDENCE or SILENCE, verifiable by SHA-256 chain
2. **Multi-language proofs** — same formula in APL, Prolog, Haskell, Lean 4 simultaneously
3. **Living civilization** — not a chatbot demo, a running simulation with 15 AI citizens
4. **Zero human governance** — agents make deals, break rules, get prosecuted, all autonomously
5. **WORM cryptography** — every action permanently sealed, no retroactive editing
6. **Real AI calls** — every agent dialogue is Claude Haiku 4.5 via AWS Bedrock, in character

---

## What's Next

- Wire ROBOB as a formal UiPath Orchestrator API endpoint
- Godot 4.6.3 3D voxel city (Codex has built the GDScript layer)
- LISP machine emulator with tagged memory heap
- Agent Olympics: competitive multi-civilization scenarios
- SealForge: enterprise WORM-seal-as-a-service

---

*Built in one session. What DeepMind tried to ship for 10 years.*
*Sims × Minecraft × Sovereign AI × Cryptographic Law.*
*SnapKitty — 2025*
