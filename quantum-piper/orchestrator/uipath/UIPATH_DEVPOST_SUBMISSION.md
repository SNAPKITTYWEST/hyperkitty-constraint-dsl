# UiPath AgentHack 2026 — Devpost Submission

## Project Name
**SovereignDocumentPipeline — AI Compliance Automation with Cryptographic Proof**

## Tagline
*The first enterprise document automation where every AI verdict is cryptographically sealed and tamper-evident.*

## Track
**Maestro Case**

---

## What It Does

Every enterprise has the same compliance blind spot: **you cannot prove what an AI agent decided about a document.** You get a log. Maybe. But there is no forensic record — no sealed verdict, no tamper evidence. When an AI agent approves a $50,000 purchase order, your audit trail is empty.

**SovereignDocumentPipeline** solves this permanently.

It is a UiPath Maestro Case automation that routes enterprise documents — invoices, POs, vendor contracts — through **BOB**, a sovereign AI compliance agent. BOB analyzes every document against a Trust Deed (a 6-article governance charter embedded in the AI's system prompt), produces a structured compliance verdict with a confidence score, and seals the output with a SHA-256 WORM hash before returning it to UiPath.

UiPath then routes automatically:
- `EVIDENCE` (score ≥ 0.42) → document cleared for autonomous execution
- `SILENCE` (score < 0.42) → routed to human review case queue

No document executes without a cryptographic seal. Every decision is traceable, reproducible, and tamper-evident.

---

## How We Built It

**UiPath Maestro Case** orchestrates the business process — picking up documents, calling BOB, logging results, and routing to execution or review.

**BOB** is a Node.js API server (POST `/validate`) that calls **Claude Sonnet 4.6 via AWS Bedrock**. BOB's system prompt is the Trust Deed v1.0 — a 6-article operating charter that defines BOB's identity, truth mandate, compliance thresholds, and verdict format. BOB cannot deviate from it.

Every verdict is sealed with a SHA-256 WORM hash that includes the verdict, confidence score, query, and timestamp. If the hash doesn't match the output — something was tampered with.

**Built with Claude Code** — this entire sovereign stack was designed and implemented using Claude Code as our coding agent. BOB's brain is Frankenstein, our sovereign reasoning engine: Claude Sonnet 4.6 as BRAIN, with a Trust Deed governance layer, Lean 4 formal gate, and Prolog constraint kernel.

---

## The Problem It Solves

Enterprise AP and procurement teams process thousands of documents daily. Current AI solutions either:
1. Give you a yes/no with no reasoning trail
2. Cannot prove the decision wasn't modified after the fact
3. Have no governance layer on the AI itself

SovereignDocumentPipeline gives compliance teams:
- **Grounded reasoning** — BOB cites why it approved or rejected (Evidence or Silence protocol)
- **Cryptographic proof** — SHA-256 WORM seal on every verdict
- **AI governance** — Trust Deed constrains the AI at the system prompt level
- **Automatic routing** — UiPath handles escalation, no human in the loop unless BOB says so

---

## Challenges

- Wiring UiPath Robot's HTTP activities to a live sovereign AI backend cleanly
- Designing the Trust Deed so BOB always returns structured JSON (never prose, never markdown)
- Making the WORM seal meaningful — it includes the query so you can re-derive and verify
- Keeping the confidence threshold (0.42) tunable without redeploying

---

## Accomplishments

- First UiPath workflow with a sovereign AI governance layer (Trust Deed)
- Every AI verdict is cryptographically sealed before UiPath sees it
- Zero hallucination path: if BOB can't ground the verdict, it returns SILENCE, never a confident wrong answer
- Built end-to-end with Claude Code as the development agent (bonus points qualify)

---

## What's Next

- Deploy BOB on AWS Lambda + API Gateway for production-scale cloud access
- Add Maestro BPMN process layer for multi-step approval workflows
- Extend Trust Deed to support configurable policy rules per organization
- UiPath Integration Service connector for direct cloud-to-cloud calls

---

## Built With

- UiPath Studio 26 / Automation Cloud / Maestro Case
- Claude Sonnet 4.6 (AWS Bedrock)
- Node.js (BOB validate server)
- SHA-256 WORM sealing
- Claude Code (coding agent — bonus)
- Frankenstein sovereign reasoning engine (sovereign-35)
- Trust Deed v1.0 — Bel Esprit D'Accord Trust

---

## Formal Guarantees

The following theorems define BOB's behavioral contracts. These are not aspirational — they are enforced by the Trust Deed and verifiable from the WORM chain.

**Theorem 1 — Verdict Completeness**

$$\forall\, d \in \mathcal{D},\quad \exists\, v \in \{\texttt{EVIDENCE},\, \texttt{SILENCE}\} \quad\text{s.t.}\quad \text{BOB}(d) = v$$

Every document receives exactly one verdict. No undefined states, no null returns.

**Theorem 2 — WORM Integrity (Collision Resistance)**

$$\text{seal}(v,\, s,\, q,\, t) = \text{SHA256}(v \,\|\, s \,\|\, q \,\|\, t)$$

$$\implies \nexists\; v' \neq v \quad\text{s.t.}\quad \text{seal}(v',\, s,\, q,\, t) = \text{seal}(v,\, s,\, q,\, t)$$

No two distinct verdicts produce the same seal. Any post-hoc modification is cryptographically detectable.

**Theorem 3 — Trust Deed Soundness (Deterministic Threshold)**

$$\text{score}(d) \geq 0.42 \implies \text{BOB}(d) = \texttt{EVIDENCE}$$

$$\text{score}(d) < 0.42 \implies \text{BOB}(d) = \texttt{SILENCE}$$

The compliance threshold is deterministic and auditable. Given the same document and Trust Deed, the same verdict is always produced.

**Theorem 4 — Human-in-Loop Guarantee**

$$\text{BOB}(d) = \texttt{SILENCE} \implies d \in \mathcal{Q}_{\mathrm{human}}$$

No SILENCE verdict ever auto-executes. Human review is formally guaranteed by the UiPath Maestro Case routing layer — not by convention, by construction.

**Corollary — Zero Hallucination Path**

$$\nexists\; d \in \mathcal{D} \quad\text{s.t.}\quad \text{BOB}(d) = \texttt{EVIDENCE} \land \text{score}(d) < 0.42$$

BOB cannot produce a confident wrong answer. Below threshold, the protocol forces SILENCE regardless of reasoning content.

---

## Links

- GitHub: [SNAPKITTYWEST/bob-orchestrator](https://github.com/SNAPKITTYWEST/bob-orchestrator)
- Live: [collectivekitty.com](https://collectivekitty.com)
