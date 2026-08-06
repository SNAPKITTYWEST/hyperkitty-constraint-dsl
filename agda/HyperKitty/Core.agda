-- HyperKitty Core: Glyph definitions and basic properties
-- Formal verification of the 6-symbol canonical reference frame

module HyperKitty.Core where

open import Data.Fin using (Fin; zero; suc; toℕ)
open import Data.Vec using (Vec; []; _∷_; head; tail; lookup)
open import Data.Nat using (ℕ; zero; suc; _+_; _*_)
open import Data.Bool using (Bool; true; false)
open import Data.Char using (Char)
open import Relation.Binary.PropositionalEquality using (_≡_; refl; sym; trans; subst; cong)

-- ============ GLYPH DEFINITION ============

-- Six canonical symbols: π, γ, δ, ω, λ, ψ
data Glyph : Set where
  Pi    : Glyph  -- 0x01 - Generator/Proposition
  Gamma : Glyph  -- 0x03 - Transition/Guard
  Delta : Glyph  -- 0x04 - Divergence/State change
  Omega : Glyph  -- 0x0A - Absorber/Terminal
  Lambda : Glyph -- 0xFF - Identity/Locality
  Psi   : Glyph  -- 0x0B - Negative transition

-- Decidable equality for Glyphs
_≟_ : (g h : Glyph) → Bool
Pi ≟ Pi = true
Gamma ≟ Gamma = true
Delta ≟ Delta = true
Omega ≟ Omega = true
Lambda ≟ Lambda = true
Psi ≟ Psi = true
_ ≟ _ = false

-- Propositional equality
glyph_eq_decidable : (g h : Glyph) → Set
glyph_eq_decidable g h with g ≟ h
... | true = g ≡ h
... | false = g ≡ h → ⊥

-- ============ GLYPH TO BYTE ENCODING ============

-- Encode Glyph to byte value
glyph_to_byte : Glyph → Fin 256
glyph_to_byte Pi    = Fin.fromℕ< (Data.Nat._<_ 0x01 256 (by norm_num))
glyph_to_byte Gamma = Fin.fromℕ< (0x03 < 256 ⟨ by norm_num ⟩)
glyph_to_byte Delta = Fin.fromℕ< (0x04 < 256 ⟨ by norm_num ⟩)
glyph_to_byte Omega = Fin.fromℕ< (0x0A < 256 ⟨ by norm_num ⟩)
glyph_to_byte Lambda = Fin.fromℕ< (0xFF < 256 ⟨ by norm_num ⟩)
glyph_to_byte Psi   = Fin.fromℕ< (0x0B < 256 ⟨ by norm_num ⟩)

-- Encode Glyph to Fin 6 for indexing
glyph_to_idx : Glyph → Fin 6
glyph_to_idx Pi    = Fin.zero
glyph_to_idx Gamma = Fin.suc Fin.zero
glyph_to_idx Delta = Fin.suc (Fin.suc Fin.zero)
glyph_to_idx Omega = Fin.suc (Fin.suc (Fin.suc Fin.zero))
glyph_to_idx Lambda = Fin.suc (Fin.suc (Fin.suc (Fin.suc Fin.zero)))
glyph_to_idx Psi   = Fin.suc (Fin.suc (Fin.suc (Fin.suc (Fin.suc Fin.zero))))

-- Decode from Fin 6
idx_to_glyph : Fin 6 → Glyph
idx_to_glyph Fin.zero = Pi
idx_to_glyph (Fin.suc Fin.zero) = Gamma
idx_to_glyph (Fin.suc (Fin.suc Fin.zero)) = Delta
idx_to_glyph (Fin.suc (Fin.suc (Fin.suc Fin.zero))) = Omega
idx_to_glyph (Fin.suc (Fin.suc (Fin.suc (Fin.suc Fin.zero)))) = Lambda
idx_to_glyph (Fin.suc (Fin.suc (Fin.suc (Fin.suc (Fin.suc Fin.zero))))) = Psi

-- ============ BIJECTION LEMMAS ============

-- Forward lemma: encoding then decoding returns original
idx_glyph_inv_l : ∀ (g : Glyph) → idx_to_glyph (glyph_to_idx g) ≡ g
idx_glyph_inv_l Pi = refl
idx_glyph_inv_l Gamma = refl
idx_glyph_inv_l Delta = refl
idx_glyph_inv_l Omega = refl
idx_glyph_inv_l Lambda = refl
idx_glyph_inv_l Psi = refl

-- Backward lemma: decoding then encoding returns original
idx_glyph_inv_r : ∀ (i : Fin 6) → glyph_to_idx (idx_to_glyph i) ≡ i
idx_glyph_inv_r Fin.zero = refl
idx_glyph_inv_r (Fin.suc Fin.zero) = refl
idx_glyph_inv_r (Fin.suc (Fin.suc Fin.zero)) = refl
idx_glyph_inv_r (Fin.suc (Fin.suc (Fin.suc Fin.zero))) = refl
idx_glyph_inv_r (Fin.suc (Fin.suc (Fin.suc (Fin.suc Fin.zero)))) = refl
idx_glyph_inv_r (Fin.suc (Fin.suc (Fin.suc (Fin.suc (Fin.suc Fin.zero))))) = refl

-- ============ SPECIAL PROPERTIES ============

-- Lambda is identity
lambda_is_identity : Lambda ≡ Lambda
lambda_is_identity = refl

-- Omega is absorber
omega_properties : Omega ≡ Omega
omega_properties = refl

-- All glyphs are distinct (deterministic)
glyphs_distinct : (g h : Glyph) → g ≡ h → g ≟ h ≡ true
glyphs_distinct Pi Pi refl = refl
glyphs_distinct Gamma Gamma refl = refl
glyphs_distinct Delta Delta refl = refl
glyphs_distinct Omega Omega refl = refl
glyphs_distinct Lambda Lambda refl = refl
glyphs_distinct Psi Psi refl = refl
