# HyperKitty Constraint DSL

**NAND-complete constraint kernel. XSLT meta-programming. K3 surface entropy. HOL Light proofs. BH mechanics verified.**

[![License: BSL 1.1](https://img.shields.io/badge/license-BSL_1.1-f59e0b?style=flat-square)](LICENSE)
[![Origin: 2026-08-02](https://img.shields.io/badge/origin-2026--08--02-34d399?style=flat-square)](ORIGIN.md)

This repository contains the complete HyperKittyConstraintDSL specification and all derived implementations that were built during the development of the HyperKitty sovereign AI OS. Many of these files were created on a phone via Termux and never made it into the main repo.

## What is this

The Constraint DSL is a formal specification language for deterministic, proof-backed agent systems. Every valid agent state must satisfy:

```xml
V(l_i) = 1 IFF:
  (dA + dE == dL + dR)        -- accounting balance
  AND (I(S_t) == I(S_{t+1}))  -- invariant preserved
  AND (entropy(l_i) <= 0.20)  -- entropy gate
  AND (proof(l_i) == true)    -- proof certificate
```

The entropy bound `H <= 0.20 nats` is not arbitrary — it is the boundary between deterministic and probabilistic routing. The K3 surface Hodge number distribution has entropy 0.831 nats, which **violates** this bound. This is the first concrete mathematical object the DSL formally rejects.

## Repository Structure

```
hyperkitty-constraint-dsl/
|
|-- spec/                        Core DSL specifications
|   |-- hyperkitty-constraint-dsl.xml    Full DSL v1.0
|   |-- universe-ledger-dsl.xml          Universe Ledger extension
|   +-- k3-entropy-dsl.xml               K3 surface checker spec
|
|-- hol/                         HOL Light proofs
|   |-- k3_entropy.ml            K3 Hodge entropy > 0.20 (proven)
|   +-- extract_k3.ml            OCaml extraction
|
|-- ocaml/                       Extracted OCaml
|   |-- k3_checker.mli           Interface
|   |-- k3_checker.ml            Implementation (k3_entropy_violates_bound = true)
|   +-- dune                     Build
|
|-- bh-mechanics/                Black hole thermodynamics (verified)
|   |-- fortran/bh_numerics.f90  Schwarzschild, Kerr, Wald, LQG, String
|   |-- janet/bh_arrays.janet    Array model, contracts, Coq emission
|   |-- coq/bh_verified.v        10 theorems, ULP bounds, GSL proofs
|   |-- c/bh_bridge.h/.c         C FFI, runtime-checked
|   |-- c/test_runner.c          27 tests, all verified
|   +-- Makefile                 Single command: make test
|
|-- xslt/                        XSLT meta-programming
|   |-- polyglot-codegen.xsl     JSON+XML+SGML -> bash targets
|   +-- constraint-to-shell.xsl  DSL -> executable scripts
|
|-- ui/                          Visual constraint editor (React)
|   +-- src/App.jsx              NAND gates, agent nodes, proof badges
|
|-- docs/
|   |-- ORIGIN.md                Genesis story (phone, 2026-08-02)
|   +-- papers/                  Academic paper connections
|
+-- LICENSE                      BSL 1.1
```

## The K3 Result

The K3 surface has Hodge numbers: h^{0,0}=1, h^{1,1}=20, h^{2,2}=1, rest=0 (sum=24).

Shannon entropy of this distribution:
```
H = -[4*(1/24)*ln(1/24) + (20/24)*ln(20/24)]
  = 0.8314... nats
```

This **violates** the HyperKitty entropy bound H <= 0.20. The HOL Light proof in `hol/k3_entropy.ml` establishes this formally. The extracted constant `k3_entropy_violates_bound = true` is a verified boolean — not computed at runtime, but proved.

This makes K3 surfaces the first geometric objects formally rejected by the constraint system.

## Build

```bash
# BH mechanics (Fortran + Janet + Coq + C)
cd bh-mechanics && make test
# Expected: 27/27 tests pass

# K3 entropy checker (OCaml)
cd ocaml && dune build && dune exec test_k3

# XSLT codegen
xsltproc xslt/polyglot-codegen.xsl spec/hyperkitty-constraint-dsl.xml
```

## Connection to Main Paper

The DSL predates the formal algebra. The entropy bound H<=0.20 appears in the DSL as an XML constraint before it was named in the QRA tensor paper. The `uint64_t corr` field in the genesis C bus struct became `omega` in SLA. The NAND kernel became the BooleanKernel in this DSL before it was connected to the Jordan algebra root system.

See `docs/papers/connection-to-qra.md` for the full intellectual chain.

---

*SNAPKITTYWEST · Bel Esprit D'Accord Irrevocable Trust · 2026*
*BSL 1.1 — routing logic protected until 2029-01-01, then MIT*
