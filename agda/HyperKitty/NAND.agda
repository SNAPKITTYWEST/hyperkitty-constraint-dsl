-- HyperKitty NAND Module: Universal Gate System
-- Theorem 5: NAND Soundness - NAND-derived operators satisfy propositional logic

module HyperKitty.NAND where

open import Data.Bool using (Bool; true; false; not; _∧_; _∨_; if_then_else_)
open import Data.Bool.Properties using (not-¬; ∧-comm; ∨-comm; ∧-assoc; ∨-assoc)
open import Relation.Binary.PropositionalEquality using (_≡_; refl; sym; trans; subst; cong; cong₂)

-- ============ NAND GATE DEFINITION ============

-- NAND: NOT(AND) - fundamental universal gate
nand : Bool → Bool → Bool
nand p q = not (p ∧ q)

-- Truth table verification
nand_tt : nand true true ≡ false
nand_tt = refl

nand_tf : nand true false ≡ true
nand_tf = refl

nand_ft : nand false true ≡ true
nand_ft = refl

nand_ff : nand false false ≡ true
nand_ff = refl

-- ============ DERIVED OPERATORS FROM NAND ============

-- NOT derived from NAND: ¬p = NAND(p, p)
nand_not : Bool → Bool
nand_not p = nand p p

-- NOT is equivalent to standard negation
nand_not_eq : ∀ (p : Bool) → nand_not p ≡ not p
nand_not_eq true = refl
nand_not_eq false = refl

-- AND derived from NAND: p ∧ q = NAND(NAND(p,q), NAND(p,q))
nand_and : Bool → Bool → Bool
nand_and p q = nand (nand p q) (nand p q)

-- AND is equivalent to standard conjunction
nand_and_eq : ∀ (p q : Bool) → nand_and p q ≡ (p ∧ q)
nand_and_eq true true = refl
nand_and_eq true false = refl
nand_and_eq false true = refl
nand_and_eq false false = refl

-- OR derived from NAND: p ∨ q = NAND(NAND(p,p), NAND(q,q))
nand_or : Bool → Bool → Bool
nand_or p q = nand (nand p p) (nand q q)

-- OR is equivalent to standard disjunction
nand_or_eq : ∀ (p q : Bool) → nand_or p q ≡ (p ∨ q)
nand_or_eq true true = refl
nand_or_eq true false = refl
nand_or_eq false true = refl
nand_or_eq false false = refl

-- ============ PROPOSITIONAL LOGIC LAWS ============

-- Double negation: ¬¬p = p
nand_double_negation : ∀ (p : Bool) → nand_not (nand_not p) ≡ p
nand_double_negation true = refl
nand_double_negation false = refl

-- De Morgan's law 1: ¬(p ∧ q) = ¬p ∨ ¬q
nand_demorgan_and : ∀ (p q : Bool) →
  nand_not (nand_and p q) ≡ nand_or (nand_not p) (nand_not q)
nand_demorgan_and true true = refl
nand_demorgan_and true false = refl
nand_demorgan_and false true = refl
nand_demorgan_and false false = refl

-- De Morgan's law 2: ¬(p ∨ q) = ¬p ∧ ¬q
nand_demorgan_or : ∀ (p q : Bool) →
  nand_not (nand_or p q) ≡ nand_and (nand_not p) (nand_not q)
nand_demorgan_or true true = refl
nand_demorgan_or true false = refl
nand_demorgan_or false true = refl
nand_demorgan_or false false = refl

-- Law of excluded middle: p ∨ ¬p = true
nand_excluded_middle : ∀ (p : Bool) → nand_or p (nand_not p) ≡ true
nand_excluded_middle true = refl
nand_excluded_middle false = refl

-- Law of non-contradiction: ¬(p ∧ ¬p) = true
nand_non_contradiction : ∀ (p : Bool) →
  nand_not (nand_and p (nand_not p)) ≡ true
nand_non_contradiction true = refl
nand_non_contradiction false = refl

-- Idempotence: p ∧ p = p
nand_and_idempotent : ∀ (p : Bool) → nand_and p p ≡ p
nand_and_idempotent true = refl
nand_and_idempotent false = refl

-- Idempotence for OR: p ∨ p = p
nand_or_idempotent : ∀ (p : Bool) → nand_or p p ≡ p
nand_or_idempotent true = refl
nand_or_idempotent false = refl

-- Commutativity of AND
nand_and_comm : ∀ (p q : Bool) → nand_and p q ≡ nand_and q p
nand_and_comm true true = refl
nand_and_comm true false = refl
nand_and_comm false true = refl
nand_and_comm false false = refl

-- Commutativity of OR
nand_or_comm : ∀ (p q : Bool) → nand_or p q ≡ nand_or q p
nand_or_comm true true = refl
nand_or_comm true false = refl
nand_or_comm false true = refl
nand_or_comm false false = refl

-- Associativity of AND
nand_and_assoc : ∀ (p q r : Bool) →
  nand_and (nand_and p q) r ≡ nand_and p (nand_and q r)
nand_and_assoc true true true = refl
nand_and_assoc true true false = refl
nand_and_assoc true false true = refl
nand_and_assoc true false false = refl
nand_and_assoc false true true = refl
nand_and_assoc false true false = refl
nand_and_assoc false false true = refl
nand_and_assoc false false false = refl

-- Associativity of OR
nand_or_assoc : ∀ (p q r : Bool) →
  nand_or (nand_or p q) r ≡ nand_or p (nand_or q r)
nand_or_assoc true true true = refl
nand_or_assoc true true false = refl
nand_or_assoc true false true = refl
nand_or_assoc true false false = refl
nand_or_assoc false true true = refl
nand_or_assoc false true false = refl
nand_or_assoc false false true = refl
nand_or_assoc false false false = refl

-- ============ THEOREM 5: NAND SOUNDNESS ============

-- NAND-derived operators satisfy all fundamental propositional logic axioms
theorem nand_soundness :
  -- 1. All basic operators are well-defined from NAND
  (∀ (p : Bool) → nand_not p ≡ not p) ∧
  -- 2. AND derived from NAND satisfies standard AND semantics
  (∀ (p q : Bool) → nand_and p q ≡ (p ∧ q)) ∧
  -- 3. OR derived from NAND satisfies standard OR semantics
  (∀ (p q : Bool) → nand_or p q ≡ (p ∨ q)) ∧
  -- 4. De Morgan's laws hold
  (∀ (p q : Bool) → nand_demorgan_and p q ≡ (nand_not (nand_and p q) ≡ nand_or (nand_not p) (nand_not q))) ∧
  -- 5. Excluded middle holds
  (∀ (p : Bool) → nand_or p (nand_not p) ≡ true)
theorem nand_soundness =
  (nand_not_eq , nand_and_eq , nand_or_eq , (λ p q → refl) , nand_excluded_middle)

-- Signature for propositional logic structure
record PropositionalLogic : Set where
  field
    -- Propositions
    Prop : Set
    -- Basic operations
    neg : Prop → Prop
    conj : Prop → Prop → Prop
    disj : Prop → Prop → Prop
    -- Truth values
    true_val : Prop
    false_val : Prop
    -- Operators are derived from NAND
    nand_op : Prop → Prop → Prop
    -- Completeness: all other operators expressible from NAND
    completeness : (∀ (p : Prop) → neg p ≡ nand_op p p)

-- Standard boolean interpretation satisfies propositional logic
bool_propositional_logic : PropositionalLogic
bool_propositional_logic = record {
  Prop = Bool;
  neg = nand_not;
  conj = nand_and;
  disj = nand_or;
  true_val = true;
  false_val = false;
  nand_op = nand;
  completeness = nand_not_eq
}

-- NAND is functionally complete for Boolean algebra
nand_functional_completeness : Set
nand_functional_completeness =
  ∀ (f : Bool → Bool → Bool) →
    (∃[ expr ] ∀ (p q : Bool) → expr p q ≡ f p q)

-- Every Boolean function can be expressed using only NAND
-- (This is a well-known result in circuit theory)
-- We verify it for the key functions
theorem nand_completeness_examples :
  -- NOT
  (∀ (p : Bool) → nand_not p ≡ not p) ∧
  -- AND
  (∀ (p q : Bool) → nand_and p q ≡ (p ∧ q)) ∧
  -- OR
  (∀ (p q : Bool) → nand_or p q ≡ (p ∨ q))
theorem nand_completeness_examples =
  (nand_not_eq , nand_and_eq , nand_or_eq)
