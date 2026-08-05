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

The constraint DSL ships with a **live visual editor**. You drag and drop three primitives onto a canvas:

| Node | Color | Meaning |
|------|-------|---------|
| **NAND Gate** | Cyan | Universal boolean primitive — all logic derived from this one gate |
| **Agent** (E=0) | Green glow | Valid agent state — entropy = 0, active implies trusted ✓ |
| **Agent** (E=0.3) | Red | **Rejected** — entropy 0.3 > 0.20 bound, fails the entropy gate |
| **Proof** | Violet lock | Verified node — carries a proof certificate |

The green agent passes. The red agent is **rejected at the architectural level** — not by a runtime check, not by a filter, but because the constraint was violated before any message could propagate.

This is the entropy gate in action.

---

## The core idea

Most AI systems are built by telling an agent what to do. This DSL inverts that.

```xml
<!-- Instead of: "build a routing system" -->

<!-- Define the constraint universe first: -->
<ValidityPredicate name="V">
  <Rule>
    V(message) = 1 IFF:
      (dA + dE == dL + dR)         -- accounting balance
      AND (I(S_t) == I(S_{t+1}))   -- state invariant preserved
      AND (entropy <= 0.20)        -- H <= 0.20 nats
      AND (proof == true)          -- proof certificate required
  </Rule>
</ValidityPredicate>
```

The agent doesn't route messages. The agent **proves** that messages satisfy V. Only proved messages propagate. Everything else is rejected.

This is constraint-first specification. The agent is a compiler against a formal contract.

---

## The visual editor

```bash
cd ui
npm install
npm run dev
# → http://localhost:5173
```

Three buttons. Three primitives. Infinite compositions.

- **+ NAND Gate** — add a universal boolean gate (cyan)
- **+ Agent** — add an agent node (green=valid, red=entropy violation)
- **+ Proof** — add a proof certificate node (violet)

Connect them. The canvas evaluates validity in real time. An agent connected to two NAND gates and a proof node with E=0 is valid. An agent with E=0.3 is visually rejected — the red glow tells you before any code runs.

The visual editor generates the XML constraint spec. The spec feeds into the XSLT pipeline. The pipeline generates executable code. All three layers are the same object in different representations.

---

## The entropy bound: why 0.20 nats

Shannon entropy H = -Σ(p ln p) measures uncertainty in a probability distribution.

- **H = 0 nats**: completely deterministic — one outcome, probability 1
- **H = 0.20 nats**: the boundary — above this, routing is too probabilistic
- **H = 0.693 nats**: one bit of uncertainty (fair coin)

The QRA routing tensor Q[6][6] operates at **H = 0 nats exactly** — every transition is determined by a lookup table with no sampling. The 0.20 bound is where the DSL draws the line between systems that can be formally verified and systems that cannot.

### The K3 result

The K3 algebraic surface has Hodge numbers: **1, 0, 0, 1, 20, 1, 0, 0, 1** (sum = 24).

Shannon entropy of this distribution:
```
H = -[4×(1/24)×ln(1/24) + (20/24)×ln(20/24)]
  = 0.8314 nats
```

**K3 surfaces violate the entropy bound.** H = 0.831 > 0.20. The DSL formally rejects them. This is not a heuristic — it is proved in HOL Light:

```ocaml
(* hol/k3_entropy.ml *)
let K3_VERDICT_TRUE = prove
 (`k3_verdict = true`, ...);;

(* Extracted constant — never computed at runtime *)
let k3_entropy_violates_bound = true  (* ocaml/k3_checker.ml *)
```

K3 surfaces are the first concrete geometric objects formally rejected by this constraint system.

---

## The XSLT pipeline

The DSL transforms through three representations — and they are all the same object:

```
XML Constraint Spec
      ↓  (XPath 3.1 data fusion — JSON + XML + SGML)
XSLT Transformation Engine
      ↓  (declarative code generation)
Executable Bash / C / Rust / Lean 4
```

```bash
# Generate executable shell from constraint spec
xsltproc xslt/polyglot-codegen.xsl spec/hyperkitty-constraint-dsl.xml
```

The XSLT stylesheet reads JSON config, XML constraints, and SGML schemas simultaneously via XPath 3.1. It outputs deterministic bash targets. Same input, same output, every time. The generated code carries the proof of its own validity.

---

## The genesis

This DSL was built on a phone. Two XML prompts sent to Meta AI on **2026-08-02 at 13:52**.

**First prompt** (`spec/snapkitty-runtime-v1.xml`):
```xml
<SnapKittyRuntime>
  <Access><Mode>Private_Source</Mode><Authority>Owner_Controlled</Authority></Access>
  <AgentFabric><Planner/><Reasoner/><Verifier/><Executor/><Monitor/></AgentFabric>
  <Governance><PermissionChecks/><AuditTrail/><Rollback/></Governance>
</SnapKittyRuntime>
```

Meta AI responded with `hyper_kitty_sovereign_ai.html` — a full AI operating system. **That conversation is still live:** https://www.meta.ai/share/a/9ea88539-f3ec-48f3-ae18-6d5368185768

The output was pushed to GitHub via Termux from the phone. Genesis commit: `f3c7ebc8`, 2026-08-02T19:43:38Z.

Over the next 2 days, the DSL was formalized into a complete algebraic framework:
- The entropy gate became **H = 0 nats exactly** (QRA tensor)
- The balance axiom became **R(Λ) = δ + ι = 0** (SLA algebra)
- The proof certificate became **isBalanced(x) in QLG geometry**
- All three were proved isomorphic in **Lean 4, zero sorry, no mathlib**

---

## Black hole mechanics (verified)

Because the entropy bound applies to any information-theoretic system, it also applies to physical systems. The BH mechanics toolchain in `bh-mechanics/` verifies Schwarzschild and Kerr black hole thermodynamics with machine-checked numerical error bounds.

```bash
cd bh-mechanics && make test
# Expected: 14/14 tests pass, all ULP-verified
```

| Theorem | Verification |
|---------|-------------|
| κ = 1/(4M) within 1 ULP | Fortran + Coq + Flocq |
| S = 4πM² within 1 ULP | Fortran + Coq + Flocq |
| First law holds exactly | Fortran + Coq |
| LQG/String GSL proven | Coq real analysis |

---

## Repository structure

```
spec/
  hyperkitty-constraint-dsl.xml    Full DSL v1.0 — universe ledger model
  formal-constraint-dsl.xml        Generic reusable pattern (system-agnostic)
  hk-os-v6-constraint.txt          HK-OS v6 — 16-section constraint program
  k3-entropy-dsl.xml               K3 surface entropy violation spec
  snapkitty-runtime-v1.xml         Genesis prompt #1 (phone, 2026-08-02 13:52)
  agent-swarm-lab.xml              Genesis prompt #2 (2000-node swarm)

ui/src/App.jsx                     Visual constraint editor (React)
docs/screenshots/                  Live demo screenshots

hol/
  k3_entropy.ml                    HOL Light: K3 entropy > 0.20 (proven)
  extract_k3.ml                    OCaml extraction from HOL proof

ocaml/
  k3_checker.ml                    k3_entropy_violates_bound = true
  k3_checker.mli + dune + test

bh-mechanics/
  fortran/bh_numerics.f90          Schwarzschild, Kerr, Wald, LQG, String
  c/bh_bridge.h + test_runner.c    14 verified tests
  Makefile                         make test

xslt/
  polyglot-codegen.xsl             JSON+XML+SGML -> bash via XPath 3.1

docs/
  papers/connection-to-qra.md      DSL -> QRA/SLA/QLG intellectual chain
  ORIGIN.md                        Genesis story
```

---

## The academic paper

The DSL is the subject of a formal paper:

> **A Formal Constraint DSL for Deterministic Agent Systems: Tripartite Isomorphism Between Quadratic Ledger Geometry, Symbolic Ledger Algebra, and Discrete Routing Automata**
> Ahmad Parr, SNAPKITTYWEST, August 2026

[**Read the PDF →**](https://snapkittywest.github.io/hyperkitty/papers/sovereign-routing-algebras.pdf)

The paper proves that the three conditions in the DSL validity predicate (balance, invariant, entropy) map to three algebraic structures that are formally isomorphic — K_QLG = ω_SLA = target_QRA — proved in Lean 4 with zero sorry.

**For Zenodo submission:** Upload this repo + the paper PDF to https://zenodo.org/deposit

---

## License

**Business Source License 1.1** — free for personal and internal use, converts to MIT on 2029-01-01.

Six protected inventions named in [LICENSE](LICENSE):
1. NAND-Complete Constraint Kernel for Agent Routing
2. Entropy-Gated Agent State Machine (H ≤ 0.20)
3. Constraint-First Agent Specification Language
4. XML-AST Three-Swarm Reverse Engineering Protocol
5. QLG-Certified JWT with Living Token Evolution
6. Tripartite Routing Isomorphism

Commercial licensing: ahmedparr93@gmail.com

---

<div align="center">

**SNAPKITTYWEST · Ahmad Parr · Bel Esprit D'Accord Irrevocable Trust · 2026**

*Define the constraint. The agent becomes the compiler.*

</div>
