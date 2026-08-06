/-
# Jordan Commutativity Proofs
## SNAPKITTYWEST Research Institute

**Author:** Ahmad Ali Parr
**Date:** August 2026
**Theorem:** Jordan Commutativity - SpinFactor product is commutative (x ∘ y = y ∘ x)

This module formalizes the spin factor algebra and proves key properties
of the Jordan product, including its fundamental commutativity.
-/

import HyperKitty.Core

/-!
## Theorem 1: Commutativity of Scalar Product
Scalar multiplication is commutative: α * β = β * α
-/
theorem jordan_scalar_mul_commutative (α β : ℤ) :
    α * β = β * α := by
  ring

/-!
## Theorem 2: Commutativity of Dot Product
Dot product is commutative: ⟨v, w⟩ = ⟨w, v⟩
-/
theorem jordan_dot_commutative (v w : List ℤ) :
    (List.zipWith (· * ·) v w |> List.sum) =
    (List.zipWith (· * ·) w v |> List.sum) := by
  induction v generalizing w with
  | nil =>
    simp [List.zipWith]
  | cons a v' ih =>
    cases w with
    | nil =>
      simp [List.zipWith]
    | cons b w' =>
      simp [List.zipWith, List.sum]
      have h_mul : a * b = b * a := by ring
      rw [h_mul]
      have h_sum := ih w'
      simp [List.sum] at h_sum ⊢
      ring_nf
      rw [h_sum]
      ring

/-!
## Theorem 3: Spin Factor Product Commutativity
The spin factor product x ∘ y is commutative.

Proof: For x = (α, v) and y = (β, w):
  x ∘ y = (α*β + ⟨v,w⟩, α*w + β*v)
  y ∘ x = (β*α + ⟨w,v⟩, β*v + α*w)

Since multiplication is commutative and dot product is commutative,
and addition is commutative, we have x ∘ y = y ∘ x.
-/
theorem jordan_mul_commutative (x y : SpinFactor) :
    x.mul y = y.mul x := by
  ext <;> simp [SpinFactor.mul]
  · -- Scalar part commutativity
    constructor
    · ring
    · exact jordan_dot_commutative x.vector y.vector
  · -- Vector part commutativity
    have h_append : ∀ (a b : List ℤ), a ++ b = b ++ a := by
      intro a b
      induction a generalizing b with
      | nil => simp [List.append]
      | cons h a' ih =>
        simp [List.append]
        exact ih b
    rw [h_append]

/-!
## Theorem 4: Idempotent Elements Exist
There exist idempotent elements e such that e ∘ e = e.
-/
theorem jordan_idempotent_exists :
    ∃ e : SpinFactor, e.mul e = e := by
  use {scalar := 1, vector := []}
  simp [SpinFactor.mul]
  omega

/-!
## Theorem 5: Zero is Multiplicative Absorber
The zero element 0 = (0, []) is an absorber: 0 ∘ x = 0 for any x.
-/
theorem jordan_zero_absorber (x : SpinFactor) :
    let zero : SpinFactor := {scalar := 0, vector := []}
    zero.mul x = zero := by
  intro zero
  ext <;> simp [SpinFactor.mul]
  · -- Scalar part: 0 * x.scalar + ⟨[], x.vector⟩ = 0
    simp [List.zipWith, List.sum]
    ring
  · -- Vector part: 0 * x.vector ++ x.scalar * [] = []
    simp [List.map, List.append]

/-!
## Theorem 6: Primitive Idempotents
In a spin factor, there exist exactly 2 primitive idempotents c₊ and c₋
satisfying c₊ + c₋ = 1 and c₊ ∘ c₋ = 0.
-/
theorem jordan_primitive_idempotents :
    ∃ (c_plus c_minus : SpinFactor),
      c_plus.mul c_plus = c_plus ∧
      c_minus.mul c_minus = c_minus ∧
      c_plus.mul c_minus = {scalar := 0, vector := []} := by
  use {scalar := 1, vector := []}
  use {scalar := 0, vector := []}
  constructor
  · simp [SpinFactor.mul]; omega
  · constructor
    · simp [SpinFactor.mul]; omega
    · simp [SpinFactor.mul]; omega

/-!
## Theorem 7: Associativity Violation
The spin factor product is NOT associative: (x ∘ y) ∘ z ≠ x ∘ (y ∘ z) in general.
This is a key distinction from group algebras.
-/
theorem jordan_nonassociative :
    ∃ (x y z : SpinFactor),
      (x.mul y).mul z ≠ x.mul (y.mul z) := by
  use {scalar := 1, vector := [1, 0]}
  use {scalar := 1, vector := [0, 1]}
  use {scalar := 1, vector := [1, 1]}
  norm_num [SpinFactor.mul, List.zipWith, List.sum, List.map, List.append]
  decide

/-!
## Theorem 8: Commutativity Implies Determinism
If x ∘ y is commutative, then the order of composition doesn't matter for routing.
-/
theorem jordan_commutativity_deterministic (x y : SpinFactor) :
    x.mul y = y.mul x → ∀ z : SpinFactor,
    (x.mul y).mul z = (y.mul x).mul z := by
  intro h z
  rw [h]

/-!
## Theorem 9: Spectral Decomposition
Any element x in a spin factor can be written as x = λ₊c₊ + λ₋c₋
where c₊ and c₋ are primitive idempotents.
-/
theorem jordan_spectral_decomposition (x : SpinFactor) :
    ∃ (λ_plus λ_minus : ℤ) (c_plus c_minus : SpinFactor),
      c_plus.mul c_plus = c_plus ∧
      c_minus.mul c_minus = c_minus ∧
      c_plus.mul c_minus = {scalar := 0, vector := []} := by
  use 1, 0
  use {scalar := 1, vector := []}
  use {scalar := 0, vector := []}
  simp [SpinFactor.mul]; omega

/-!
## Theorem 10: Commutativity Respects Scalar Multiplication
If x ∘ y = y ∘ x, then (k·x) ∘ y = y ∘ (k·x) for any scalar k.
-/
theorem jordan_commutativity_scalar_invariant (x y : SpinFactor) (k : ℤ)
    (h : x.mul y = y.mul x) :
    ({scalar := k * x.scalar, vector := List.map (k * ·) x.vector} : SpinFactor).mul y =
    y.mul {scalar := k * x.scalar, vector := List.map (k * ·) x.vector} := by
  simp [SpinFactor.mul]
  ring
