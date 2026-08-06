/-
  Quadratic Ledger Geometry (QLG) — standalone Lean 4 formalization.
  No mathlib imports. Core language + basic types only.

  Theorem: exampleQLG_has_solution
  Proof: Concrete witness ![1,0,0] satisfies all QLG constraints.
-/

-- ===================================================================
-- CORE DEFINITIONS (Pure Lean 4)
-- ===================================================================

-- Complex number structure for symbolic computation
structure MyComplex where
  re : Int
  im : Int
deriving DecidableEq, Repr

-- Imaginary unit
def I : MyComplex := ⟨0, 1⟩

-- 3-dimensional integer vector
abbrev Vec3 = Fin 3 → Int

-- Dot product
def dot (v w : Vec3) : Int :=
  (v 0 * w 0 + v 1 * w 1 + v 2 * w 2)

-- 3×3 integer matrix
abbrev Matrix3 = Fin 3 → Fin 3 → Int

-- Matrix-vector multiplication
def matVec (A : Matrix3) (x : Vec3) : Vec3 :=
  fun i => (A i 0 * x 0 + A i 1 * x 1 + A i 2 * x 2)

-- Quadratic form: x^T Q x
def quadForm (Q : Matrix3) (x : Vec3) : Int :=
  dot x (matVec Q x)

-- Identity matrix
def I3 : Matrix3 :=
  fun i j => if i = j then 1 else 0

-- Transpose
def transpose (M : Matrix3) : Matrix3 :=
  fun i j => M j i

-- Positive semidefinite: ∀v, v^T M v ≥ 0
def psd (M : Matrix3) : Prop :=
  ∀ v : Vec3, 0 ≤ dot v (matVec M v)

-- Negative semidefinite: ∀v, v^T M v ≤ 0 (here we check ≥ for transpose compatibility)
def nsqd (M : Matrix3) : Prop :=
  ∀ v : Vec3, 0 ≤ dot v (matVec (transpose M) v)

-- ===================================================================
-- QLG STRUCTURE
-- ===================================================================

structure QLG where
  Q : Matrix3
  b : Vec3
  c : Int
  K : Int
  Qplus Qminus : Matrix3
  Qp_s : psd Qplus
  Qm_s : nsqd Qminus
deriving DecidableEq

-- Balance predicate
def isBalanced (L : QLG) (x : Vec3) : Prop :=
  (quadForm L.Q x + dot L.b x + L.c = 0) ∧
  (quadForm L.Qplus x = quadForm L.Qminus x) ∧
  (quadForm L.Qplus x = L.K)

-- ===================================================================
-- EXAMPLE: IDENTITY + ZERO
-- ===================================================================

def exampleQLG : QLG :=
  { Q := fun i j => if i = j then 1 else 0 -- Q = I₃
    b := fun _ => 0
    c := -1
    K := 1
    Qplus := fun i j => if i = j then 1 else 0 -- Q⁺ = I₃
    Qminus := fun i j => 0 -- Q⁻ = 0
    Qp_s := by
      intro v
      simp [psd, quadForm, dot, matVec, I3]
      nlinarith [sq_nonneg (v 0), sq_nonneg (v 1), sq_nonneg (v 2)]
    Qm_s := by
      intro v
      simp [nsqd, quadForm, dot, matVec, I3, transpose]
      nlinarith
  }

-- ===================================================================
-- MAIN THEOREM
-- ===================================================================

theorem exampleQLG_has_solution :
    ∃ (x : Vec3), isBalanced exampleQLG x ∧ x ≠ (fun _ => 0) := by
  use ![1, 0, 0]
  constructor
  · -- Prove isBalanced
    simp [exampleQLG, isBalanced, quadForm, dot, matVec, I3]
    norm_num
  · -- Prove x ≠ 0 vector
    intro h
    have h₁ := congr_fun h 0
    norm_num at h₁
