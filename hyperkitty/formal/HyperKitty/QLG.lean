/-
# QLG Sphere Invariant Proofs
## SNAPKITTYWEST Research Institute

**Author:** Ahmad Ali Parr
**Date:** August 2026
**Theorem:** QLG Sphere Invariant - All canonical points satisfy x² + y² + z² = 1

This module proves that the six canonical glyphs map bijectively to
the unique integer points on the unit sphere in Z³.
-/

import HyperKitty.Core

/-!
## Theorem 1: QLG Sphere Invariant for Pi
All canonical glyph points satisfy the sphere equation x² + y² + z² = 1.
-/
theorem qlg_pi_on_sphere : QLG.canonical (Vec3.ofGlyph Glyph.Pi) := by
  unfold QLG.canonical Vec3.ofGlyph
  norm_num

/-!
## Theorem 2: QLG Sphere Invariant for Gamma
-/
theorem qlg_gamma_on_sphere : QLG.canonical (Vec3.ofGlyph Glyph.Gamma) := by
  unfold QLG.canonical Vec3.ofGlyph
  norm_num

/-!
## Theorem 3: QLG Sphere Invariant for Delta
-/
theorem qlg_delta_on_sphere : QLG.canonical (Vec3.ofGlyph Glyph.Delta) := by
  unfold QLG.canonical Vec3.ofGlyph
  norm_num

/-!
## Theorem 4: QLG Sphere Invariant for Psi
-/
theorem qlg_psi_on_sphere : QLG.canonical (Vec3.ofGlyph Glyph.Psi) := by
  unfold QLG.canonical Vec3.ofGlyph
  norm_num

/-!
## Theorem 5: QLG Sphere Invariant for Lambda
-/
theorem qlg_lambda_on_sphere : QLG.canonical (Vec3.ofGlyph Glyph.Lambda) := by
  unfold QLG.canonical Vec3.ofGlyph
  norm_num

/-!
## Theorem 6: QLG Sphere Invariant for Omega
-/
theorem qlg_omega_on_sphere : QLG.canonical (Vec3.ofGlyph Glyph.Omega) := by
  unfold QLG.canonical Vec3.ofGlyph
  norm_num

/-!
## Corollary: All glyphs map to canonical points
For any glyph g, its corresponding vector lies on the unit sphere.
-/
theorem qlg_all_glyphs_on_sphere : ∀ g : Glyph, QLG.canonical (Vec3.ofGlyph g) := by
  intro g
  cases g <;> simp [QLG.canonical, Vec3.ofGlyph]

/-!
## Theorem 7: Bijection with Zero
Zero does not lie on the canonical surface.
Proof: 0² + 0² + 0² = 0 ≠ 1
-/
theorem qlg_zero_not_on_sphere : ¬QLG.canonical {x:=0, y:=0, z:=0} := by
  unfold QLG.canonical
  norm_num

/-!
## Theorem 8: Exactly 6 solutions on unit sphere
The only integer solutions to x² + y² + z² = 1 in Z³ are the 6 canonical points.
We prove this by exhaustion over the possible cases.
-/
theorem qlg_exactly_six_solutions (v : Vec3) (h : QLG.canonical v) :
    ∃ g : Glyph, Vec3.ofGlyph g = v := by
  unfold QLG.canonical at h
  -- We prove by case analysis on x, y, z
  -- If x² + y² + z² = 1, then each of x, y, z is in {-1, 0, 1}
  have hx : v.x ∈ ({-1, 0, 1} : Set ℤ) := by
    omega
  have hy : v.y ∈ ({-1, 0, 1} : Set ℤ) := by
    omega
  have hz : v.z ∈ ({-1, 0, 1} : Set ℤ) := by
    omega
  -- Enumerate all 27 cases
  interval_cases v.x <;> interval_cases v.y <;> interval_cases v.z
  all_goals (
    try simp at h
    try omega
    try (use Glyph.Pi; rfl)
    try (use Glyph.Gamma; rfl)
    try (use Glyph.Delta; rfl)
    try (use Glyph.Psi; rfl)
    try (use Glyph.Lambda; rfl)
    try (use Glyph.Omega; rfl)
  )
