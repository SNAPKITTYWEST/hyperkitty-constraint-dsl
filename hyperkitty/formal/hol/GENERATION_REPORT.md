# HOL Light Proof Obligations Generation Report

**Status:** GENERATED_UNVERIFIED  
**Date:** 2026-08-06  
**Authority:** XSLT Constraint Inversion Engine v1.0.0  
**Project:** HyperKitty Formal Verification  
**Organization:** SNAPKITTYWEST

---

## Summary

Generated HOL Light proof obligation registry from canonical XSLT invariant registry.

### Artifact

**File:** `constraint_obligations.ml` (933 lines)

- **Type Declarations:** 6 constraint kinds + 11 type mappings
- **Core Invariants:** 31 obligations (0001-0031)
- **QLG Routing Glyphs:** 10 obligations (0032-0041)
- **Total Invariants:** 41 proof obligations
- **Correspondence Entries:** 22 cross-prover mappings (HOL ↔ Lean ↔ Agda)
- **Authority Boundaries:** 7 enforcement rules

---

## Section 1: Canonical QLG Routing Glyphs

**Scope:** 6 routing primitives from Quadratic Ledger Geometry (QLG)

### The Six Glyphs

| Glyph | Name | Code | Role |
|-------|------|------|------|
| Pi | Propositio | 0x01 | Send proposition |
| Gamma | Guard | 0x03 | Receive guard check |
| Delta | Transition | 0x04 | Execute state transition |
| Omega | Conclusio | 0x0A | Absorbing terminal |
| Lambda | Locality | 0xFF | Identity element |
| Psi | Negative | 0x0B | Negative transition |

### Glyph Obligations (Invariants 0032-0041)

#### INV-0032: QLG_ROUTING_PI
- **Type:** Routing closure
- **Proof Stub:** `prove_0032`
- **Statement:** Pi glyph routing produces valid next state under QLG tensor
- **HOL Ref:** `hol-0032-qlg-routing-pi`
- **Lean Ref:** `lean-0032-qlg-routing-pi`
- **Agda Ref:** `agda-0032-qlg-routing-pi`

#### INV-0033: QLG_ROUTING_GAMMA
- **Type:** Routing closure
- **Proof Stub:** `prove_0033`
- **Statement:** Gamma glyph routing produces valid next state under QLG tensor
- **HOL Ref:** `hol-0033-qlg-routing-gamma`
- **Lean Ref:** `lean-0033-qlg-routing-gamma`
- **Agda Ref:** `agda-0033-qlg-routing-gamma`

#### INV-0034: QLG_ROUTING_DELTA
- **Type:** Routing closure
- **Proof Stub:** `prove_0034`
- **Statement:** Delta glyph routing produces valid next state under QLG tensor
- **HOL Ref:** `hol-0034-qlg-routing-delta`
- **Lean Ref:** `lean-0034-qlg-routing-delta`
- **Agda Ref:** `agda-0034-qlg-routing-delta`

#### INV-0035: QLG_ROUTING_OMEGA
- **Type:** Absorber property
- **Proof Stub:** `prove_0035`
- **Statement:** Omega glyph is absorber: ∀prev. ω(prev) = ω
- **HOL Ref:** `hol-0035-qlg-routing-omega`
- **Lean Ref:** `lean-0035-qlg-routing-omega`
- **Agda Ref:** `agda-0035-qlg-routing-omega`

#### INV-0036: QLG_ROUTING_LAMBDA
- **Type:** Identity property
- **Proof Stub:** `prove_0036`
- **Statement:** Lambda glyph is identity: ∀prev. λ(prev) = prev
- **HOL Ref:** `hol-0036-qlg-routing-lambda`
- **Lean Ref:** `lean-0036-qlg-routing-lambda`
- **Agda Ref:** `agda-0036-qlg-routing-lambda`

#### INV-0037: QLG_ROUTING_PSI
- **Type:** Routing closure
- **Proof Stub:** `prove_0037`
- **Statement:** Psi glyph routing produces valid next state under QLG tensor
- **HOL Ref:** `hol-0037-qlg-routing-psi`
- **Lean Ref:** `lean-0037-qlg-routing-psi`
- **Agda Ref:** `agda-0037-qlg-routing-psi`

#### INV-0038: QLG_TENSOR_DETERMINISTIC
- **Type:** Tensor property
- **Proof Stub:** `prove_0038`
- **Statement:** Tensor yields unique next state (determinism)
- **HOL Ref:** `hol-0038-qlg-tensor-deterministic`
- **Lean Ref:** `lean-0038-qlg-tensor-deterministic`
- **Agda Ref:** `agda-0038-qlg-tensor-deterministic`

#### INV-0039: QLG_TENSOR_CLOSED
- **Type:** Tensor property
- **Proof Stub:** `prove_0039`
- **Statement:** Tensor output remains in glyph domain (closure)
- **HOL Ref:** `hol-0039-qlg-tensor-closed`
- **Lean Ref:** `lean-0039-qlg-tensor-closed`
- **Agda Ref:** `agda-0039-qlg-tensor-closed`

#### INV-0040: QLG_ABSORBER_IDEMPOTENT
- **Type:** Omega property
- **Proof Stub:** `prove_0040`
- **Statement:** Omega idempotence: ω(ω) = ω
- **HOL Ref:** `hol-0040-qlg-absorber-idempotent`
- **Lean Ref:** `lean-0040-qlg-absorber-idempotent`
- **Agda Ref:** `agda-0040-qlg-absorber-idempotent`

#### INV-0041: QLG_IDENTITY_NEUTRAL
- **Type:** Lambda property
- **Proof Stub:** `prove_0041`
- **Statement:** Lambda neutrality (identity in tensor context)
- **HOL Ref:** `hol-0041-qlg-identity-neutral`
- **Lean Ref:** `lean-0041-qlg-identity-neutral`
- **Agda Ref:** `agda-0041-qlg-identity-neutral`

---

## Section 2: QLG Tensor Definition

**Authority Source:** Paper Section 3.1 (Quadratic Ledger Geometry)

### Routing Function
```
Q : Fin 6 → Fin 6 → Fin 6
Q(curr, prev) → next
```

Implemented in HOL as:
```ocaml
let routing_tensor : (int -> int -> int) =
  fun curr prev ->
    match (curr, prev) with
    | (4, j) -> j          (* Lambda: identity row *)
    | (3, _) -> 3          (* Omega: absorber row *)
    | (0, _) -> 2          (* Pi row *)
    | (1, j) -> if j = 4 then 2 else 3  (* Gamma row *)
    | (2, _) -> 3          (* Delta row *)
    | (5, j) -> if j = 4 then 2 else 3  (* Psi row *)
    | _ -> 3
```

### Tensor Properties (from Paper)

| Property | Mathematical | HOL Obligation |
|----------|-------------|-----------------|
| Closure | Q : G×G→G | INV-0039 |
| Deterministic | ∀g,h. ∃!n. Q(g,h)=n | INV-0038 |
| Omega absorber | ∀h. Q(ω,h)=ω | INV-0035 |
| Lambda identity | ∀g. Q(g,λ)=g ∧ Q(λ,g)=g | INV-0041 |
| Idempotence | Q(ω,ω)=ω | INV-0040 |

---

## Section 3: Cross-Prover Correspondence

**Strategy:** Symbol bijection across HOL ↔ Lean ↔ Agda

### New Correspondence Mappings

```
HOL Name                 Lean Name                 Agda Name
---------                ---------                 ---------
routing_glyph           RoutingGlyph              RoutingGlyph
routing_tensor          routingTensor             routing-tensor
is_valid_glyph          isValidGlyph              is-valid-glyph
is_valid_routing_step   isValidRoutingStep        is-valid-routing-step
is_absorber             isAbsorber                is-absorber
is_identity             isIdentity                is-identity
```

### Verification Order

1. **Phase 6 (HOL):** Type-check `constraint_obligations.ml`
2. **Phase 7 (Lean):** Emit Lean 4 equivalents from symbol table
3. **Phase 8 (Lean):** Prove HOL↔Lean semantic equivalence (6 mappings)
4. **Phase 9 (Agda):** Emit Agda declarations
5. **Phase 10 (Agda):** Type-check 6 glyph + 4 tensor invariants
6. **Phase 11 (Agda):** Generate 20 iterations × 10 obligations = 200 derivations

---

## Section 4: Authority Boundaries

**XSLT Authority:** Classification, inversion, normalization, emission (THIS FILE)

- Can classify constraints into 6 constraint kinds
- Can invert constraints and normalize them
- Can emit type declarations and proof obligation statements
- **CANNOT** assign VERIFIED status

**HOL Authority:** Type checking, theorem proving, semantic verification

- HOL Light compiler type-checks all declarations
- HOL proof tactics discharge obligations
- HOL assigns VERIFIED status only to proven goals

**Lean Authority:** Cross-prover correspondence

- Lean 4 proves HOL↔Lean semantic equivalence
- Lean establishes canonical invariant correspondence
- Lean bridges to Agda

**Agda Authority:** Final verification

- Agda type-checks all derived iterations
- Agda proves absence of postulates in verified paths
- Agda confirms mathematical soundness

---

## Execution Schedule

| Phase | Step | Action | Tool |
|-------|------|--------|------|
| 5 | emit-hol | Generate this file | XSLT |
| 6 | check-hol | Type-check obligations | HOL Light |
| 7 | emit-lean | Generate Lean declarations | XSLT |
| 8 | check-lean | Compile & type-check | Lean 4 |
| 9 | emit-agda | Generate Agda declarations | XSLT |
| 10 | check-agda | Type-check iterations | Agda |
| 11 | derive-agda-20x | Generate 200 derivations | Agda (auto) |
| 12 | check-correspondence | Verify prover equivalence | Harness |

---

## Symbol Table

**Core QLG Symbols:**

```
("routing_glyph", "RoutingGlyph", "RoutingGlyph")
("pi", "Pi", "pi")
("gamma", "Gamma", "gamma")
("delta", "Delta", "delta")
("omega", "Omega", "omega")
("lambda", "Lambda", "lambda")
("psi", "Psi", "psi")
("routing_of", "routingOf", "routing-of")
("is_valid_glyph", "isValidGlyph", "is-valid-glyph")
("is_valid_routing_step", "isValidRoutingStep", "is-valid-routing-step")
("is_absorber", "isAbsorber", "is-absorber")
("is_identity", "isIdentity", "is-identity")
```

---

## Status & Next Steps

**Status:** GENERATED_UNVERIFIED (ready for HOL compilation)

**Next Steps:**
1. Load `constraint_obligations.ml` into HOL Light
2. Verify all type declarations compile
3. Discharge proof obligations (external tactic scripts)
4. Record results in `correspondence_obligations` registry
5. Pass proven symbols to Lean 4
6. Execute cross-prover equivalence checks

---

## References

- **Paper:** "Sovereign Routing Algebras: A Tripartite Isomorphism Between QLG, SLA, and DARA"
- **Section 2.1:** Glyph definitions and indexing
- **Section 3.1:** QRA Routing Tensor (Q matrix)
- **Section 3.3:** Canonical QLG surface properties
- **Source:** QLG.lean (Lean 4 reference implementation)

---

**Generated by:** XSLT Constraint Inversion Engine v1.0.0  
**Authority:** GENERATED_UNVERIFIED  
**Timestamp:** 2026-08-06T13:36Z
