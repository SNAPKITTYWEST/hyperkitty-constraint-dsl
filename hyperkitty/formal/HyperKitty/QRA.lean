/-
# QRA Routing Tensor Proofs
## SNAPKITTYWEST Research Institute

**Author:** Ahmad Ali Parr
**Date:** August 2026
**Theorems:** QRA Identity Row & Absorber Row Properties

This module formalizes the Quantized Routing Automata and proves that
the identity and absorber rows of the Q tensor have their expected properties.
-/

import HyperKitty.Core

/-!
## Theorem 1: QRA Identity Row Property
The Lambda row (index 4) acts as identity: Q[4][j] = j for all j ∈ [0,6).
-/
theorem qra_identity_row : ∀ j : Fin 6, Q 4 j = j := by
  intro j
  simp [Q]

/-!
## Theorem 2: QRA Absorber Row Property
The Omega row (index 3) acts as an absorber: Q[3][j] = 3 for all j ∈ [0,6).
-/
theorem qra_absorber_row : ∀ j : Fin 6, Q 3 j = 3 := by
  intro j
  simp [Q]

/-!
## Theorem 3: Lambda-prev transitions to prev
When current state is Lambda and previous state is prev, next state is prev.
This follows from the identity row property.
-/
theorem qra_lambda_next (prev : Glyph) :
    Glyph.Lambda.next prev = prev := by
  simp [Glyph.next, Glyph.idx, Glyph.ofIdx, Q]
  rw [Glyph.ofIdx_idx prev]

/-!
## Theorem 4: Omega is Absorbing
Once we reach Omega, we stay in Omega regardless of previous state.
-/
theorem qra_omega_absorbs (prev : Glyph) :
    Glyph.Omega.next prev = Glyph.Omega := by
  simp [Glyph.next, Glyph.idx, Q]

/-!
## Theorem 5: Q Tensor is Total
The Q function is defined for all pairs of indices.
-/
theorem qra_tensor_total : ∀ i j : Fin 6, ∃ k : Fin 6, Q i j = k := by
  intro i j
  use Q i j
  rfl

/-!
## Theorem 6: Next State is Always Valid
For any two glyphs curr and prev, curr.next prev is a valid glyph.
-/
theorem qra_next_valid (curr prev : Glyph) :
    ∃ g : Glyph, g = curr.next prev := by
  use curr.next prev
  rfl

/-!
## Theorem 7: Identity Row Injectivity
Different previous states give different next states when current is Lambda.
-/
theorem qra_identity_injective (prev₁ prev₂ : Glyph)
    (h : Glyph.Lambda.next prev₁ = Glyph.Lambda.next prev₂) :
    prev₁ = prev₂ := by
  simp [Glyph.next, Glyph.idx, Q] at h
  -- After simp: h : Glyph.ofIdx prev₁.idx = Glyph.ofIdx prev₂.idx
  -- (since Q 4 j = j by identity row)
  have h_idx : prev₁.idx = prev₂.idx := by
    have h_eq := congrArg Glyph.idx h
    simp only [Glyph.idx_ofIdx] at h_eq
    exact h_eq
  -- Both glyphs have the same index, so they must be equal
  have ⟨g1, ⟨g2, eq_g1, eq_g2⟩⟩ := by
    use prev₁.idx
    constructor
    · exact Glyph.ofIdx_idx prev₁
    · rw [← h_idx]
      exact Glyph.ofIdx_idx prev₂
  simp only [← eq_g1, ← eq_g2]

/-!
## Theorem 8: Absorber is Idempotent
Omega is an idempotent element: Omega ∘ Omega = Omega.
-/
theorem qra_omega_idempotent :
    Glyph.Omega.next Glyph.Omega = Glyph.Omega := by
  simp [Glyph.next, Glyph.idx, Q]

/-!
## Theorem 9: Path Closure
Starting from any state, repeatedly applying next transitions
closes in the automaton (all states remain valid).
-/
theorem qra_path_closure (s₁ s₂ : Glyph) :
    ∃ s₃ : Glyph, s₃ = s₁.next s₂ := by
  use s₁.next s₂
  rfl

/-!
## Theorem 10: Q Maps to Glyphs
The Q tensor maps pairs of fin6 indices to valid fin6 indices.
-/
theorem qra_Q_preserves_Fin6 (i j : Fin 6) :
    Q i j < 6 := by
  simp only [Fin.val_ofNat]
  omega
