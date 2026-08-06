-- HyperKitty SLA Module: Symbolic Ledger Algebra
-- Theorem 3: SLA compositional closure

module HyperKitty.SLA where

open import Data.Integer using (ℤ; _+_; _-_; _*_; _≤_; _<_; 0ℤ)
open import Data.Int.Properties using (+-comm; +-assoc)
open import Relation.Binary.PropositionalEquality using (_≡_; refl; sym; trans; subst; cong; cong₂)
open import Relation.Nullary using (¬_; Dec; yes; no)

-- ============ LEDGER DEFINITION ============

-- Symbolic Ledger Algebra (SLA)
-- Components: size (s), debit (δ), credit (ι), domain (ω)
record Ledger : Set where
  constructor mk_ledger
  field
    s : ℤ   -- size
    δ : ℤ   -- debit
    ι : ℤ   -- credit
    ω : ℤ   -- domain

-- ============ BALANCE PROPERTIES ============

-- A ledger is balanced if δ + ι = 0
is_balanced : Ledger → Set
is_balanced λ = Ledger.δ λ + Ledger.ι λ ≡ 0ℤ

-- Constructor for balanced ledger (credit is negation of debit)
mk_balanced : ℤ → ℤ → ℤ → Ledger
mk_balanced s δ ω = mk_ledger s δ (-δ) ω

-- Property: mk_balanced always creates balanced ledger
mk_balanced_is_balanced : ∀ (s δ ω : ℤ) →
  is_balanced (mk_balanced s δ ω)
mk_balanced_is_balanced s δ ω = trans (cong (_+ (-δ)) refl) (ℤ.+-inv-r δ)

-- ============ LEDGER OPERATIONS ============

-- Composition operator: ⊕
-- Combines two ledgers: (λ_A ⊕ λ_B)
ledger_compose : Ledger → Ledger → Ledger
ledger_compose λ_a λ_b =
  mk_ledger
    (Ledger.s λ_a + Ledger.s λ_b)
    (Ledger.δ λ_a + Ledger.δ λ_b)
    (Ledger.ι λ_a + Ledger.ι λ_b)
    (Ledger.ω λ_a + Ledger.ω λ_b)

-- Infix notation
infixl 6 _⊕_
_⊕_ : Ledger → Ledger → Ledger
_⊕_ = ledger_compose

-- Identity element: zero ledger
identity_ledger : Ledger
identity_ledger = mk_ledger 0ℤ 0ℤ 0ℤ 0ℤ

-- Property: identity is balanced
identity_is_balanced : is_balanced identity_ledger
identity_is_balanced = refl

-- ============ THEOREM 3: COMPOSITIONAL CLOSURE ============

-- If λ_A and λ_B are balanced, then λ_A ⊕ λ_B is balanced
theorem sla_compositional_closure :
  ∀ (λ_a λ_b : Ledger) →
  is_balanced λ_a → is_balanced λ_b →
  is_balanced (λ_a ⊕ λ_b)
sla_compositional_closure λ_a λ_b h_a h_b =
  let
    -- Proof: (δ_a + δ_b) + (ι_a + ι_b) = 0
    -- Reorder: (δ_a + ι_a) + (δ_b + ι_b) = 0
    -- Apply hypotheses: 0 + 0 = 0
    step1 : Ledger.δ λ_a + Ledger.δ λ_b + (Ledger.ι λ_a + Ledger.ι λ_b) ≡
            Ledger.δ λ_a + Ledger.ι λ_a + (Ledger.δ λ_b + Ledger.ι λ_b) :=
      by ring
    step2 : Ledger.δ λ_a + Ledger.ι λ_a + (Ledger.δ λ_b + Ledger.ι λ_b) ≡ 0ℤ + 0ℤ :=
      cong₂ (_+_) h_a h_b
    step3 : (0ℤ : ℤ) + 0ℤ ≡ 0ℤ :=
      refl
  in trans (trans step1 step2) step3

-- Special case: composing a balanced ledger with identity preserves balance
compose_with_identity : ∀ (λ : Ledger) →
  is_balanced λ → is_balanced (λ ⊕ identity_ledger)
compose_with_identity λ h =
  sla_compositional_closure λ identity_ledger h identity_is_balanced

-- Composition is associative
composition_associative : ∀ (λ_a λ_b λ_c : Ledger) →
  (λ_a ⊕ λ_b) ⊕ λ_c ≡ λ_a ⊕ (λ_b ⊕ λ_c)
composition_associative λ_a λ_b λ_c = by ring

-- Composition preserves balance: closed under ⊕
closure_property : ∀ (λ_a λ_b : Ledger) →
  is_balanced λ_a → is_balanced λ_b →
  (λ_c : Ledger) → λ_c ≡ λ_a ⊕ λ_b → is_balanced λ_c
closure_property λ_a λ_b h_a h_b λ_c h_c =
  subst is_balanced h_c (sla_compositional_closure λ_a λ_b h_a h_b)

-- The set of balanced ledgers is closed under composition
balanced_set_closure : Set
balanced_set_closure =
  ∀ (λ_a λ_b : Ledger) →
    is_balanced λ_a → is_balanced λ_b → is_balanced (λ_a ⊕ λ_b)

-- Proof that this property holds
balanced_closure_holds : balanced_set_closure
balanced_closure_holds = sla_compositional_closure
