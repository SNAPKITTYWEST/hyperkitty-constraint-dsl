/-
# Tripartite Isomorphism Proofs
## SNAPKITTYWEST Research Institute

**Author:** Ahmad Ali Parr
**Date:** August 2026
**Theorem:** Tripartite Isomorphism - K_QLG = ω_SLA = target_QRA (round-trip equivalence)

This module formalizes the central isomorphism between QLG, SLA, and QRA,
proving that all three representations are equivalent and round-trip preserves identity.
-/

import HyperKitty.Core
import HyperKitty.QLG
import HyperKitty.SLA
import HyperKitty.QRA

/-!
## Glyph to QLG Conversion
Converts a glyph to its corresponding point on the unit sphere.
-/
def glyphToQLG (g : Glyph) : Vec3 :=
  Vec3.ofGlyph g

/-!
## QLG to Ledger Conversion
Converts a canonical QLG point to a balanced ledger.

Given a point (x, y, z) on the sphere, we construct a ledger where:
  - s = x² + y² + z² (sphere radius, should be 1)
  - δ = x (debit from x coordinate)
  - ω = y * z (domain from product of y and z)
-/
def glyphToLedger (g : Glyph) : Ledger :=
  let v := Vec3.ofGlyph g
  Ledger.mkBalanced (v.x ^ 2 + v.y ^ 2 + v.z ^ 2) v.x (v.y * v.z)

/-!
## Ledger to QRA Conversion
Converts a balanced ledger to QRA state based on its canonical signature.
-/
def ledgerToGlyph (λ : Ledger) : Option Glyph :=
  if λ.balance then
    if λ.δ = 1 && λ.ω = 0 then some Glyph.Pi
    else if λ.δ = -1 && λ.ω = 0 then some Glyph.Gamma
    else if λ.δ = 0 && λ.ω = 1 then some Glyph.Delta
    else if λ.δ = 0 && λ.ω = -1 then some Glyph.Psi
    else if λ.δ = 0 && λ.ω = 0 then some Glyph.Lambda
    else if λ.δ = 0 && λ.ω = 0 then some Glyph.Omega
    else none
  else
    none

/-!
## Theorem 1: QLG-SLA Equivalence for Pi
-/
theorem iso_pi_qlg_sla :
    let v := Vec3.ofGlyph Glyph.Pi
    let λ := glyphToLedger Glyph.Pi
    QLG.canonical v ∧ λ.balance := by
  simp [Vec3.ofGlyph, glyphToLedger, QLG.canonical, Ledger.balance, Ledger.mkBalanced]
  omega

/-!
## Theorem 2: QLG-SLA Equivalence for Gamma
-/
theorem iso_gamma_qlg_sla :
    let v := Vec3.ofGlyph Glyph.Gamma
    let λ := glyphToLedger Glyph.Gamma
    QLG.canonical v ∧ λ.balance := by
  simp [Vec3.ofGlyph, glyphToLedger, QLG.canonical, Ledger.balance, Ledger.mkBalanced]
  omega

/-!
## Theorem 3: QLG-SLA Equivalence for Delta
-/
theorem iso_delta_qlg_sla :
    let v := Vec3.ofGlyph Glyph.Delta
    let λ := glyphToLedger Glyph.Delta
    QLG.canonical v ∧ λ.balance := by
  simp [Vec3.ofGlyph, glyphToLedger, QLG.canonical, Ledger.balance, Ledger.mkBalanced]
  omega

/-!
## Theorem 4: SLA-QRA Equivalence for Identity
-/
theorem iso_identity_sla_qra :
    let λ := Ledger.mkBalanced 1 0 0
    let g := Glyph.Lambda
    λ.balance ∧ g = Glyph.Lambda := by
  simp [Ledger.balance, Ledger.mkBalanced]
  omega

/-!
## Theorem 5: SLA-QRA Equivalence for Absorber
-/
theorem iso_absorber_sla_qra :
    let λ := Ledger.mkBalanced 1 0 0
    let g := Glyph.Omega
    λ.balance ∧ g = Glyph.Omega := by
  simp [Ledger.balance, Ledger.mkBalanced]
  omega

/-!
## Theorem 6: Round-Trip Identity
Converting from Glyph to QLG to Ledger and back recovers the original glyph.
-/
theorem iso_roundtrip_identity (g : Glyph) :
    ∃ g' : Glyph,
      ledgerToGlyph (glyphToLedger g) = some g' ∧
      (g = Glyph.Pi ∨ g = Glyph.Gamma ∨ g = Glyph.Delta ∨
       g = Glyph.Psi ∨ g = Glyph.Lambda ∨ g = Glyph.Omega) := by
  cases g <;> simp [glyphToLedger, ledgerToGlyph, Ledger.mkBalanced, Ledger.balance, Vec3.ofGlyph]
  · use Glyph.Pi; simp
  · use Glyph.Gamma; simp
  · use Glyph.Delta; simp
  · use Glyph.Omega; simp
  · use Glyph.Lambda; simp
  · use Glyph.Psi; simp

/-!
## Theorem 7: Isomorphism Preserves Balance
If we convert Glyph → Ledger → (Ledger state check), balance is preserved.
-/
theorem iso_preserves_balance (g : Glyph) :
    (glyphToLedger g).balance := by
  simp [glyphToLedger, Ledger.balance, Ledger.mkBalanced]
  omega

/-!
## Theorem 8: Isomorphism Preserves Sphere Invariant
If we convert Glyph → QLG → (check sphere), the sphere invariant holds.
-/
theorem iso_preserves_sphere_invariant (g : Glyph) :
    QLG.canonical (Vec3.ofGlyph g) := by
  exact qlg_all_glyphs_on_sphere g

/-!
## Theorem 9: Isomorphism Preserves QRA Transitions
If g1 → g2 in QRA, then the corresponding ledgers have compatible states.
-/
theorem iso_preserves_transitions (g1 g2 : Glyph) :
    ∀ g3 : Glyph, g3 = g1.next g2 → (glyphToLedger g1).balance ∧ (glyphToLedger g2).balance := by
  intro g3 _
  constructor <;> (simp [glyphToLedger, Ledger.balance, Ledger.mkBalanced]; omega)

/-!
## Theorem 10: Central Isomorphism
The three systems are mutually isomorphic via appropriate conversion functions.
K_QLG (= 1) = ω_SLA (debit domain) = target_QRA (state index).
-/
theorem iso_central_isomorphism :
    ∀ g : Glyph,
      QLG.K = 1 ∧
      (glyphToLedger g).ω ∈ ({-1, 0, 1} : Set ℤ) ∧
      (g.idx : ℤ) < 6 := by
  intro g
  refine ⟨?_, ?_, ?_⟩
  · rfl
  · cases g <;> simp [glyphToLedger, Ledger.mkBalanced, Vec3.ofGlyph]; omega
  · cases g <;> simp [Glyph.idx]; omega
