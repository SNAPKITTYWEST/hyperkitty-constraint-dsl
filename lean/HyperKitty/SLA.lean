/-
# SLA Balance Axiom Proofs
## SNAPKITTYWEST Research Institute

**Author:** Ahmad Ali Parr
**Date:** August 2026
**Theorem:** SLA Balance Axiom - For balanced ledgers, δ + ι = 0 always

This module formalizes the Symbolic Ledger Algebra and proves that
balanced ledgers maintain the fundamental invariant R(λ) = δ + ι = 0.
-/

import HyperKitty.Core

/-!
## Theorem 1: Construction Preserves Balance
When we construct a ledger using mkBalanced, the balance invariant is satisfied.
-/
theorem sla_mkBalanced_preserves_balance (s δ ω : ℤ) :
    (Ledger.mkBalanced s δ ω).balance := by
  simp [Ledger.balance, Ledger.mkBalanced]
  omega

/-!
## Theorem 2: Balanced Ledger Definition
A ledger is balanced if and only if debit equals negative credit.
-/
theorem sla_balance_iff_debit_eq_neg_credit (λ : Ledger) :
    λ.balance ↔ λ.δ = -λ.ι := by
  unfold Ledger.balance
  omega

/-!
## Theorem 3: Balance Preserved by Composition
If two balanced ledgers compose, the result is balanced.
-/
theorem sla_composition_preserves_balance (λ₁ λ₂ : Ledger)
    (h₁ : λ₁.balance) (h₂ : λ₂.balance) (hω : λ₁.ω = λ₂.ω) :
    (λ₁.comp λ₂).isSome ∧ ((λ₁.comp λ₂).get (by simp [Ledger.comp, hω])).balance := by
  constructor
  · simp [Ledger.comp, hω]
  · have h_some : (λ₁.comp λ₂).isSome := by simp [Ledger.comp, hω]
    simp [Ledger.comp, hω, Ledger.balance]
    omega

/-!
## Theorem 4: Zero Ledger is Balanced
An empty ledger (all zeros) is balanced.
-/
theorem sla_zero_ledger_balanced :
    (Ledger.mkBalanced 0 0 0).balance := by
  simp [Ledger.balance, Ledger.mkBalanced]
  omega

/-!
## Theorem 5: Scalar Multiple of Balanced Ledger
If λ is balanced and k is a scalar, then k*λ is balanced.
-/
theorem sla_scalar_multiple_balanced (λ : Ledger) (k : ℤ)
    (h : λ.balance) :
    (Ledger.mkBalanced (k * λ.s) (k * λ.δ) λ.ω).balance := by
  simp [Ledger.balance, Ledger.mkBalanced]
  omega

/-!
## Theorem 6: Balance is Antisymmetric
If both λ.δ + λ.ι = 0 and λ.ι + λ.δ = 0, then they are the same.
This is trivially true by commutativity of addition, but we formalize it
to show our balance predicate is well-defined.
-/
theorem sla_balance_antisymmetric (λ : Ledger) :
    (λ.δ + λ.ι = 0) ↔ (λ.ι + λ.δ = 0) := by
  constructor <;> intro h <;> omega

/-!
## Theorem 7: Non-Zero Balanced Ledger Existence
There exist non-zero balanced ledgers.
-/
theorem sla_nonzero_balanced_ledger_exists :
    ∃ λ : Ledger, λ.balance ∧ (λ.δ ≠ 0 ∨ λ.ι ≠ 0) := by
  use Ledger.mkBalanced 5 3 1
  constructor
  · simp [Ledger.balance, Ledger.mkBalanced]
  · omega

/-!
## Theorem 8: Negation Preserves Balance
If λ is balanced, then -λ (negating all fields) is also balanced.
-/
theorem sla_negation_preserves_balance (λ : Ledger)
    (h : λ.balance) :
    ({s := -λ.s, δ := -λ.δ, ι := -λ.ι, ω := λ.ω} : Ledger).balance := by
  simp [Ledger.balance] at *
  omega

/-!
## Theorem 9: Balance Uniquely Determines Credit
Given a balanced ledger with debit δ, the credit is uniquely -δ.
-/
theorem sla_credit_unique (λ : Ledger)
    (h : λ.balance) :
    λ.ι = -λ.δ := by
  unfold Ledger.balance at h
  omega

/-!
## Theorem 10: Substitution Property
Two balanced ledgers with same domain and debit have same credit.
-/
theorem sla_same_domain_same_debit_same_credit (λ₁ λ₂ : Ledger)
    (h₁ : λ₁.balance) (h₂ : λ₂.balance)
    (hω : λ₁.ω = λ₂.ω) (hδ : λ₁.δ = λ₂.δ) :
    λ₁.ι = λ₂.ι := by
  have h₁' := sla_credit_unique λ₁ h₁
  have h₂' := sla_credit_unique λ₂ h₂
  rw [h₁', h₂', hδ]
