import HyperKitty.QLG
import HyperKitty.QRA

/-! # Witness Evolution Formalization

This module formalizes the witness evolution system for QLG-certified tokens.
-/

-- Witness: vector of 3 glyphs
structure Witness : Type where
  w : List Glyph
  
-- Canonical witness
abbrev canonicalWitness : Witness := ⟨[Glyph.Pi, Glyph.Gamma, Glyph.Delta]⟩

-- Witness evolution
abbrev evolveWitness (w : Witness) : Witness := 
  let [a, b, c] := w.w else ⟨[]⟩;
  ⟨[a.next b, b.next c, c.next a]⟩

-- Exhaustion: evolve^2 reaches [Omega, Omega, Omega]
theorem canonical_exhaustion : 
    (evolveWitness (evolveWitness canonicalWitness)).w = [Glyph.Omega, Glyph.Omega, Glyph.Omega] := by
  simp [evolveWitness, canonicalWitness, Glyph.next, Q]
  decide

-- Invalid fixed point: [Lambda, Lambda, Lambda]
theorem invalid_fixed_point : 
    evolveWitness ⟨[Glyph.Lambda, Glyph.Lambda, Glyph.Lambda]⟩ = ⟨[Glyph.Lambda, Glyph.Lambda, Glyph.Lambda]⟩ := by
  simp [evolveWitness, Glyph.next, Q]
  decide

-- Witness is exhausted if all are Omega
def Witness.isExhausted (w : Witness) : Bool :=
  w.w.all (· = Glyph.Omega)

-- Witness is at invalid fixed point
def Witness.isInvalidFixedPoint (w : Witness) : Bool :=
  w.w.all (· = Glyph.Lambda)

-- Exhaustion property
theorem witness_exhaustion_in_2_steps :
    ∀ w : Witness, w = canonicalWitness →
    (evolveWitness (evolveWitness w)).isExhausted := by
  intro w hw
  rw [hw]
  simp [Witness.isExhausted, canonical_exhaustion]
