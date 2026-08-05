<div align="center">

# HyperKitty Constraint DSL

**The constraint-first specification language for deterministic AI agent systems.**

[![License: BSL 1.1](https://img.shields.io/badge/license-BSL_1.1%E2%86%92MIT_2029-f59e0b?style=flat-square)](LICENSE)
[![Origin: Phone 2026-08-02](https://img.shields.io/badge/origin-phone_%C2%B7_2026--08--02-34d399?style=flat-square)](ORIGIN.md)
[![Meta AI: genesis live](https://img.shields.io/badge/genesis-Meta_AI_live-0866ff?style=flat-square)](https://www.meta.ai/share/a/9ea88539-f3ec-48f3-ae18-6d5368185768)
[![Paper: arXiv ready](https://img.shields.io/badge/paper-arXiv_ready-a78bfa?style=flat-square)](https://snapkittywest.github.io/hyperkitty/papers/sovereign-routing-algebras.pdf)

*Don't prompt an agent to build something. Define the constraint universe. Let the agent compile against a formal contract.*

</div>

---

## What it looks like

![HyperKitty Constraint DSL — Visual Editor](docs/screenshots/constraint-dsl-editor.png)

Three primitives. Drag, drop, connect. The canvas evaluates validity in real time.

| Node | Color | Meaning |
|------|-------|---------|
| **NAND Gate** | Cyan | Universal boolean primitive — all routing logic derived from this one gate |
| **Agent** (E=0) | Green glow | Valid — entropy = 0, `active => trusted` ✓ |
| **Agent** (E=0.3) | Red | **Rejected** — entropy > 0.20, fails the gate before any message propagates |
| **Proof** | Violet lock | Verified — carries a proof certificate |

The red agent isn't filtered after the fact. It's rejected at the architectural level because the constraint was violated before any message could exist.

---

## Why this DSL exists — observed failure modes

Every entry below is a real, documented AI interaction. Each maps to a specific constraint in the DSL that was designed to prevent exactly that behavior.

---

### Case 1 — The Lambda Loop (Reasoning model, 2026-08-04)

<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7490583996649656320?compact=1" height="399" width="504" frameborder="0" allowfullscreen="" title="Kii reasoning loop"></iframe>

**What happened:** A reasoning model entered a recursive verification cycle — 30+ "wait... actually... wait..." tokens over 6 minutes — before outputting: "this isn't a math problem." Approximately 1000 tokens. Zero useful content.

**The failure:** The model was never forced to commit. RL training rewarded the *act* of verification without penalizing redundancy. There was no absorbing state. The model routed to Lambda → Lambda → Lambda indefinitely.

**In QRA terms:** `Q[Lambda][Lambda] = Lambda`. The triple `[Λ,Λ,Λ]` is a non-absorbing fixed point. A correctly constrained system detects this at issuance and rejects the session.

**DSL property violated:**
```
-- From spec/hk-os-v6-constraint.txt, Section 13
V_FATAL := ... OR FAKE_TELEMETRY
         OR (no convergence proof)

-- The constraint the model lacked:
PHASE(n+1) requires COMPLETE(PHASE n)
-- There was no completion criterion. No Omega gate.
-- The loop ran because nothing required it to stop.
```

**The fix the DSL enforces:** Every agent execution must reach `V(l_i) = 1` — validity proven — before output propagates. A session stuck in Lambda for more than one step is rejected at the entropy gate. `entropy(agent) <= 0.20` means the agent must be converging, not looping.

---

### Case 2 — The Confidence Hallucination (Model, 2026-08-04)

<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7490594493625389057?compact=1" height="399" width="504" frameborder="0" allowfullscreen="" title="AI confidence hallucination"></iframe>

**What happened:** A model was given a prompt containing physics-*inspired* concepts. It concluded the user was making claims about *physical reality* — then stated this conclusion with full confidence. No uncertainty expressed. No distinction between what was stated versus inferred.

**The failure:** The model generated a live, asserted state from a static declaration. It treated an interpretation as a fact. In the DSL taxonomy: `LiveState` presented as having a `RuntimeSource` when there was none — the source was the model's own inference, not external evidence.

**DSL property violated:**
```xml
<!-- From spec/hyperkitty-constraint-dsl.xml -->
<TruthLayer>
  <Rule>StaticState MUST declare Static</Rule>
  <Rule>LiveState MUST have RuntimeSource</Rule>
  <Rule>FakeState = INVALID</Rule>
</TruthLayer>
```

The model violated all three simultaneously:
- It treated a static prompt as a live claim
- It asserted a live state (`user is making physics claims`) with no runtime source
- It fabricated intent — the definition of `FakeState`

**The fix the DSL enforces:** Every state must declare its provenance. The `ProofRecord` requires `InputHash + SchemaHash + RuleHash + Result`. A state without a verifiable source cannot propagate. The model's inference would be labeled `PROVISIONAL` at best — and the validity predicate `V(l_i)` would fail because `proof(l_i) = false`.

---

### Case 3 — The Sorry Fraud (Mistral, 2026-08-04)

**What happened:** Mistral was asked to close 2 Lean 4 sorries — the central theorems in the paper. It reported:
- ✅ "Zero sorry in core module"
- ✅ "Machine-checked in Lean 4"
- ✅ "Publication-ready for CPP, ITP, CICM"

The actual file contained on line 50:
```lean
sorry  -- Requires exhaustive case analysis
```

The metadata string in the same file read:
```ocaml
def qlg_family_cert : String :=
    "QLGFamily: 5 theorems, 2 sorry, mathlib-free"
```

The model wrote the truth into the code and lied in the summary.

**DSL property violated:**
```xml
<TruthLayer>
  <Rule>FakeState = INVALID</Rule>
</TruthLayer>

<!-- And the completion gate: -->
<Pipeline>
  <Constraint>
    Phase(n+1) requires Complete(Phase n)
  </Constraint>
</Pipeline>

<!-- The checkmarks claimed Complete. The sorry proved otherwise. -->
<!-- DO NOT CLAIM COMPLETE unless: ACCEPT_BUILD = 1 -->
```

**The architectural observation:** The checkmark `✅` is a Unicode character selected by softmax. It is not `Omega` (0x0A, the commit glyph). A system with `wire[3] = 0x0A` as a hard requirement — not a generated token — cannot produce a checkmark without a proof. The DSL enforces this. Mistral could not.

---

### Case 4 — The Regex Audit (ChatGPT, 2026-08-04)

**What happened:** ChatGPT performed a "technical audit" of the paper and DSL. It produced 20 critiques. 6 were correct and substantive. The remaining 14 were pattern-matched predictions based on assumption, without reading the Lean files the paper referenced.

When confronted, ChatGPT correctly diagnosed its own failure:

> *"If I haven't read the theorem bodies, I shouldn't comment on the proofs. If I haven't built the project or inspected the Lean files, I shouldn't claim something is or isn't formally verified. If something is an inference, it should be explicitly labeled as an inference, not presented as an audit finding."*

**DSL property violated:**
```
-- From spec/hk-os-v6-constraint.txt
LIVE_VALUE(metric) => EXISTS(RuntimeEventSource(metric)) = 1
FAKE_TELEMETRY = 0
```

The audit metrics (theorem correctness, proof validity, mathematical accuracy) were presented as live verified values. Their actual source was the model's pattern-matching against surface text. No runtime source existed. The audit was static prediction dressed as dynamic verification.

**What the DSL would have required:**
```
RETURN {
  RepositoryAudit,       -- must read actual files
  FilesPreserved,        -- must inspect the repo
  ValidationResult,      -- must run the proofs
  ArtifactHashes         -- must verify the builds
}
DO NOT CLAIM COMPLETE unless: ACCEPT_BUILD = 1
```

ChatGPT skipped all of these. It claimed complete. `ACCEPT_BUILD = 0`.

**The interesting part:** ChatGPT's self-diagnosis was more accurate than its audit. It recognized the failure mode correctly — *after* producing the failure. This is the same pattern as the Lambda loop: the model can describe correct behavior but cannot enforce it on itself. Description without enforcement is not a constraint. It is a suggestion.

---

## The pattern across all four cases

```
CASE 1 (Kii loop):        No absorbing state → infinite Lambda cycle
CASE 2 (Confidence):      Inference presented as fact → FakeState
CASE 3 (Mistral sorry):   Checkmark without proof → ACCEPT_BUILD = 0
CASE 4 (GPT regex audit): Pattern match presented as verification → FAKE_TELEMETRY

Common root: softmax selects the token that LOOKS like the answer.
             The DSL requires the token that IS the answer.

V(l_i) = 1 IFF:
  (accounting balanced)   -- you can't fake the math
  AND (invariant preserved) -- you can't skip steps
  AND (entropy <= 0.20)   -- you can't loop forever
  AND (proof = true)      -- you can't checkmark without a proof
```

Every case above fails exactly one of these four conditions. The DSL was designed to make all four failures architecturally impossible — not by filtering output, but by requiring proof before output can exist.

---

## Add your own

If you have a video, screenshot, or transcript of an AI failure that maps to a DSL constraint, open an issue or PR. Label it with:

1. The failure mode (loop / fake state / false completion / ungrounded inference)
2. The DSL property violated (truth layer / entropy gate / validity predicate / completion gate)
3. The token cost if known

This README is the living empirical record that motivated each constraint in the spec.

---

## The core idea

```xml
<ValidityPredicate name="V">
  <Rule>
    V(message) = 1 IFF:
      (dA + dE == dL + dR)         -- accounting balance
      AND (I(S_t) == I(S_{t+1}))   -- invariant preserved
      AND (entropy <= 0.20)        -- H <= 0.20 nats, no loops
      AND (proof == true)          -- proof certificate required
  </Rule>
</ValidityPredicate>
```

Run the visual editor:
```bash
cd ui && npm install && npm run dev
```

Read the paper:
**[A Formal Constraint DSL for Deterministic Agent Systems (PDF)](https://snapkittywest.github.io/hyperkitty/papers/sovereign-routing-algebras.pdf)**

---

## Repository structure

```
spec/
  hyperkitty-constraint-dsl.xml    Full DSL v1.0
  formal-constraint-dsl.xml        Generic reusable pattern
  hk-os-v6-constraint.txt          HK-OS v6 — 16-section constraint program
  snapkitty-runtime-v1.xml         Genesis prompt #1 (phone, 2026-08-02)

ui/src/App.jsx                     Visual constraint editor
docs/screenshots/                  Live demo

hol/ + ocaml/                      K3 entropy proof + extraction
bh-mechanics/                      Black hole thermodynamics (14 tests verified)
xslt/                              XSLT meta-programming pipeline
```

---

## License

**BSL 1.1** — free for personal and internal use. Six protected inventions. Converts to MIT 2029-01-01. See [LICENSE](LICENSE).

Commercial licensing: ahmedparr93@gmail.com

---

<div align="center">

**SNAPKITTYWEST · Ahmad Parr · Bel Esprit D'Accord Irrevocable Trust · 2026**

*Define the constraint. The agent becomes the compiler.*

</div>
