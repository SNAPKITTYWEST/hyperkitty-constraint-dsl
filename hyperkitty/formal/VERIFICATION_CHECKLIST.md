# VERIFICATION CHECKLIST — Phase 4 Proof Completion
**SNAPKITTYWEST Research Institute**

**Purpose:** Track remaining 11 sorry terms and prioritize completion  
**Status:** 50/61 theorems complete (82%)  
**Last Updated:** August 6, 2026  

---

## Priority 1: IMMEDIATE (1-2 hours)

### [ ] Q.1: QRA.qra_lambda_next
**File:** `HyperKitty/QRA.lean:36-39`  
**Status:** ⏳ In Progress  

**Theorem:**
```lean
theorem qra_lambda_next (prev : Glyph) :
    Glyph.Lambda.next prev = prev := by
  simp [Glyph.next, Glyph.idx, Glyph.ofIdx, Q]
  sorry -- Q tensor index reconstruction pending
```

**Issue:** After simp, need to reconstruct Glyph from Q index  
**Strategy:** 
1. The Q tensor maps (4, j) → j for Lambda row
2. Convert j (Fin 6) back to Glyph via Glyph.ofIdx
3. This should follow by Glyph.idx_ofIdx lemma

**Suggested Fix:**
```lean
theorem qra_lambda_next (prev : Glyph) :
    Glyph.Lambda.next prev = prev := by
  simp [Glyph.next, Glyph.idx, Q]
  -- After simp, Q(4, prev.idx) = prev.idx
  -- Need: Glyph.ofIdx (Q 4 prev.idx) = Glyph.ofIdx prev.idx
  rw [Glyph.idx_ofIdx prev]
```

**Effort:** 15 minutes

---

### [ ] Q.2: QRA.qra_identity_injective
**File:** `HyperKitty/QRA.lean:71-76`  
**Status:** ⏳ In Progress  

**Theorem:**
```lean
theorem qra_identity_injective (prev₁ prev₂ : Glyph)
    (h : Glyph.Lambda.next prev₁ = Glyph.Lambda.next prev₂) :
    prev₁ = prev₂ := by
  simp [Glyph.next, Glyph.idx, Q] at h
  sorry
```

**Issue:** From h : Q 4 prev₁.idx = Q 4 prev₂.idx, derive prev₁ = prev₂  
**Strategy:**
1. Q 4 j = j (identity row)
2. After simp, h should reduce to prev₁.idx = prev₂.idx
3. Use Glyph.idx bijection lemma

**Suggested Fix:**
```lean
theorem qra_identity_injective (prev₁ prev₂ : Glyph)
    (h : Glyph.Lambda.next prev₁ = Glyph.Lambda.next prev₂) :
    prev₁ = prev₂ := by
  simp [Glyph.next, Glyph.idx, Q] at h
  -- h : ofIdx (Q 4 prev₁.idx) = ofIdx (Q 4 prev₂.idx)
  -- h : ofIdx prev₁.idx = ofIdx prev₂.idx
  rw [Glyph.ofIdx_idx prev₁, Glyph.ofIdx_idx prev₂] at h
  have : prev₁.idx = prev₂.idx := by
    have h1 := congrArg Glyph.idx h
    simp [Glyph.idx, Glyph.ofIdx] at h1
    exact h1
  exact Glyph.ext (by simp [Glyph.idx]; exact this)
```

**Effort:** 20 minutes

---

## Priority 2: SHORT-TERM (2-4 hours)

### [ ] J.1: Jordan.jordan_dot_commutative
**File:** `HyperKitty/Jordan.lean:27-32`  
**Status:** ⏳ In Progress  

**Theorem:**
```lean
theorem jordan_dot_commutative (v w : List ℤ) :
    (List.zipWith (· * ·) v w |> List.sum) =
    (List.zipWith (· * ·) w v |> List.sum) := by
  simp [List.zipWith]
  sorry
```

**Issue:** Prove commutativity of dot product over list multiplication  
**Strategy:**
1. zipWith is commutative in its function argument when function is commutative
2. Use List.zipWith commutativity lemma
3. Multiplication is commutative by ring

**Suggested Fix:**
```lean
theorem jordan_dot_commutative (v w : List ℤ) :
    (List.zipWith (· * ·) v w |> List.sum) =
    (List.zipWith (· * ·) w v |> List.sum) := by
  induction v generalizing w with
  | nil => simp [List.zipWith]
  | cons a v' ih =>
    cases w with
    | nil => simp [List.zipWith]
    | cons b w' =>
      simp [List.zipWith]
      rw [show a * b = b * a by ring]
      rw [ih w']
```

**Effort:** 30 minutes

---

### [ ] J.2: Jordan.jordan_mul_commutative (vector part)
**File:** `HyperKitty/Jordan.lean:45-50`  
**Status:** ⏳ In Progress  

**Theorem:**
```lean
theorem jordan_mul_commutative (x y : SpinFactor) :
    x.mul y = y.mul x := by
  simp [SpinFactor.mul]
  constructor
  · ring
  · sorry  -- Vector part requires list operations
```

**Issue:** Prove vector part: α*w + β*v = β*v + α*w  
**Strategy:**
1. After simp, vector parts are list concatenations
2. Need to prove: List.map (· * β) x.vector ++ List.map (· * α) y.vector = ...
3. Use commutativity of list append + scalar map distribution

**Suggested Fix:**
```lean
theorem jordan_mul_commutative (x y : SpinFactor) :
    x.mul y = y.mul x := by
  ext <;> simp [SpinFactor.mul]
  · ring
  · -- Prove: map(·*β) x.vector ++ map(·*α) y.vector = map(·*α) y.vector ++ map(·*β) x.vector
    have h : ∀ a b : List ℤ, a ++ b = b ++ a := by
      intro a b
      -- Would need commutativity of list append, which is false!
      -- Instead: commute the vectors themselves in the definition
      sorry
    -- Alternative: redefine SpinFactor.mul to not concatenate
    sorry
```

**Note:** This may require rethinking SpinFactor multiplication definition. The vector part concatenation may need to be symmetric.

**Effort:** 45 minutes (may require refactoring)

---

### [ ] I.1: Isomorphism.iso_roundtrip_identity
**File:** `HyperKitty/Isomorphism.lean:108-115`  
**Status:** ⏳ In Progress  

**Theorem:**
```lean
theorem iso_roundtrip_identity (g : Glyph) :
    ∃ g' : Glyph,
      ledgerToGlyph (glyphToLedger g) = some g' ∧
      (g = Glyph.Pi ∨ g = Glyph.Gamma ∨ g = Glyph.Delta ∨
       g = Glyph.Psi ∨ g = Glyph.Lambda ∨ g = Glyph.Omega) := by
  cases g <;> simp [glyphToLedger, ledgerToGlyph, Ledger.mkBalanced, Ledger.balance]
  all_goals (use _; simp)
  sorry
```

**Issue:** Case analysis on all 6 glyphs + verify round-trip  
**Strategy:**
1. Expand glyphToLedger and ledgerToGlyph for each glyph
2. Verify that glyphToLedger(Pi) = (s=1, δ=1, ι=-1, ω=0) → ledgerToGlyph(...) = some Pi
3. Repeat for all 6 cases

**Suggested Fix:**
```lean
theorem iso_roundtrip_identity (g : Glyph) :
    ∃ g' : Glyph,
      ledgerToGlyph (glyphToLedger g) = some g' ∧
      (g = Glyph.Pi ∨ ...) := by
  cases g <;> (
    simp [glyphToLedger, ledgerToGlyph, Ledger.mkBalanced, Ledger.balance, Vec3.ofGlyph]
    use Glyph.Pi <;> simp  -- or appropriate glyph
  )
```

**Effort:** 40 minutes

---

## Priority 3: MEDIUM-TERM (4-8 hours)

### [ ] J.3: Jordan.jordan_zero_absorber
**File:** `HyperKitty/Jordan.lean:66-70`  
**Status:** ⏳ In Progress  

**Theorem:**
```lean
theorem jordan_zero_absorber (x : SpinFactor) :
    let zero : SpinFactor := {scalar := 0, vector := []}
    zero.mul x = zero := by
  simp [SpinFactor.mul]
  sorry
```

**Issue:** Prove 0 ∘ x = 0 (absorber property)  
**Strategy:**
1. SpinFactor.mul with scalar=0 should zero out everything
2. Verify scalar part: 0*β + dot([],w) = 0
3. Verify vector part: 0*w + β*[] = []

**Effort:** 25 minutes

---

### [ ] J.4: Jordan.jordan_nonassociative
**File:** `HyperKitty/Jordan.lean:95-102`  
**Status:** ⏳ In Progress  

**Theorem:**
```lean
theorem jordan_nonassociative :
    ∃ (x y z : SpinFactor),
      (x.mul y).mul z ≠ x.mul (y.mul z) := by
  use {scalar := 1, vector := [1, 0]}
  use {scalar := 1, vector := [0, 1]}
  use {scalar := 1, vector := [1, 1]}
  simp [SpinFactor.mul]
  sorry
```

**Issue:** Verify the explicit counterexample  
**Strategy:**
1. Compute (x.mul y).mul z for the given witnesses
2. Compute x.mul (y.mul z)
3. Show they differ using norm_num or decide

**Suggested Fix:**
```lean
theorem jordan_nonassociative :
    ∃ (x y z : SpinFactor),
      (x.mul y).mul z ≠ x.mul (y.mul z) := by
  use {scalar := 1, vector := [1, 0]}
  use {scalar := 1, vector := [0, 1]}
  use {scalar := 1, vector := [1, 1]}
  norm_num [SpinFactor.mul]
  -- Or: simp [SpinFactor.mul]; decide
```

**Effort:** 30 minutes

---

### [ ] W.1: Witness.witness_evolution_preserves_len
**File:** `HyperKitty/Witness.lean:100-106`  
**Status:** ⏳ In Progress  

**Theorem:**
```lean
theorem witness_evolution_preserves_len (w : Witness) :
    (∃ w' : Witness, evolveWitness w = some w') ∧
    (∀ w' : Witness, evolveWitness w = some w' → w'.w.length = 3) := by
  constructor
  · use ⟨[], sorry⟩
  · intro w' _
    exact w'.len_constraint
```

**Issue:** Structural property of evolveWitness; second part is complete, first part placeholder  
**Strategy:**
1. evolveWitness takes a Witness with len_constraint : w.length = 3
2. Pattern matches on [a, b, c] (the only valid case by constraint)
3. Returns some ⟨[a.next b, ...], rfl⟩ which has len_constraint built-in
4. Second part is already proven by w'.len_constraint

**Suggested Fix:**
```lean
theorem witness_evolution_preserves_len (w : Witness) :
    (∃ w' : Witness, evolveWitness w = some w') ∧
    (∀ w' : Witness, evolveWitness w = some w' → w'.w.length = 3) := by
  constructor
  · -- evolveWitness always succeeds on length-3 witnesses
    match w.w with
    | [a, b, c] =>
      use ⟨[a.next b, b.next c, c.next a], rfl⟩
      simp [evolveWitness]
    | _ =>
      exfalso
      simp [w.len_constraint]
  · intro w' _
    exact w'.len_constraint
```

**Effort:** 35 minutes

---

### [ ] W.2: Witness.witness_non_exhausted_evolves
**File:** `HyperKitty/Witness.lean:138-141`  
**Status:** ⏳ In Progress  

**Theorem:**
```lean
theorem witness_non_exhausted_evolves (w : Witness)
    (h : w.w ≠ [Glyph.Omega, Glyph.Omega, Glyph.Omega]) :
    ∃ w' : Witness, evolveWitness w = some w' := by
  use ⟨[], sorry⟩  -- Would need case analysis on w
```

**Issue:** Case analysis on all 215 non-exhausted states (out of 216)  
**Strategy:**
1. Given w : Witness with w.w.length = 3
2. Pattern match w.w = [a, b, c] (forced by len_constraint)
3. If not [Ω, Ω, Ω], then evolveWitness [a, b, c] = some [a.next b, b.next c, c.next a]
4. Use match on w.w with specific pattern

**Suggested Fix:**
```lean
theorem witness_non_exhausted_evolves (w : Witness)
    (h : w.w ≠ [Glyph.Omega, Glyph.Omega, Glyph.Omega]) :
    ∃ w' : Witness, evolveWitness w = some w' := by
  match w.w with
  | [a, b, c] =>
    use ⟨[a.next b, b.next c, c.next a], rfl⟩
    simp [evolveWitness]
  | _ =>
    exfalso
    simp [Witness.len_constraint] at w
```

**Effort:** 30 minutes

---

## Priority 4: LONG-TERM (8+ hours)

### [ ] QL.1: QLGFamily.algebraic_exhaustion_bound
**File:** `QLGFamily.lean:47-50`  
**Status:** ⏳ In Progress (Design Phase)  

**Theorem:**
```lean
theorem algebraic_exhaustion_bound :
    ∀ w₀ : List Glyph, w₀.length = 3 →
      ∃ T ≤ 36, (List.iterate evolveWitness T w₀) = [Glyph.Omega, Glyph.Omega, Glyph.Omega] := by
  sorry  -- Requires exhaustive case analysis
```

**Issue:** Must verify all 6³ = 216 possible 3-glyph witnesses exhaust in ≤36 steps  
**Strategy (Computational):**
1. Generate all 216 states: product [Glyph] [Glyph] [Glyph]
2. For each state, iterate evolveWitness until [Ω, Ω, Ω]
3. Record max number of iterations: should be ≤36
4. Write external program to generate Lean proof term

**Alternative (Proof by Reflection):**
```lean
#eval (List.range 216).map fun n =>
  let a := Glyph.ofIdx ⟨n / 36, by omega⟩
  let b := Glyph.ofIdx ⟨(n / 6) % 6, by omega⟩
  let c := Glyph.ofIdx ⟨n % 6, by omega⟩
  let witness : Witness := ⟨[a, b, c], rfl⟩
  -- Iterate evolveWitness until [Ω, Ω, Ω]
  -- Return count
```

**Suggested Fix (External Generation):**
1. Write `verify_exhaustion.py` to enumerate states
2. Run it to generate Lean decision tree
3. Embed result via `decide` tactic

**Effort:** 4-6 hours (includes external tooling)

---

### [ ] QL.2: QLGFamily.tropical_connection (partial)
**File:** `QLGFamily.lean:87-99`  
**Status:** ✅ Already Proved  

**Note:** This theorem is actually complete! The sorry is only in the algebraic exhaustion bound above.

---

## SUMMARY TABLE

| Priority | Module | Theorem | File | Status | Est. Time |
|----------|--------|---------|------|--------|-----------|
| 1a | QRA | qra_lambda_next | L36 | ⏳ | 15m |
| 1b | QRA | qra_identity_injective | L71 | ⏳ | 20m |
| 2a | Jordan | jordan_dot_commutative | L27 | ⏳ | 30m |
| 2b | Jordan | jordan_mul_commutative (vec) | L45 | ⏳ | 45m |
| 2c | Isomorphism | iso_roundtrip_identity | L108 | ⏳ | 40m |
| 3a | Jordan | jordan_zero_absorber | L66 | ⏳ | 25m |
| 3b | Jordan | jordan_nonassociative | L95 | ⏳ | 30m |
| 3c | Witness | witness_evolution_preserves_len | L100 | ⏳ | 35m |
| 3d | Witness | witness_non_exhausted_evolves | L138 | ⏳ | 30m |
| 4 | QLGFamily | algebraic_exhaustion_bound | L47 | ⏳ | 4-6h |

**Total Remaining Effort:** ~3-4 hours (Priority 1-3) + 4-6 hours (Priority 4) = **7-10 hours**

---

## Completion Strategy

### Phase 1: Quick Wins (Today)
- [ ] Complete QRA module (2 sorry) — 35 minutes
- [ ] Verify build: `lake build` succeeds with reduced sorry count
- **Expected Result:** 8/61 → 10/61 (16% completion boost)

### Phase 2: Jordan Algebra (Tomorrow)
- [ ] jordan_dot_commutative — 30m
- [ ] jordan_mul_commutative (may need design review) — 45m
- [ ] jordan_zero_absorber — 25m
- [ ] jordan_nonassociative — 30m
- **Expected Result:** 10/61 → 14/61 (additional 7%)

### Phase 3: Isomorphism & Witness (48 hours)
- [ ] Isomorphism.iso_roundtrip_identity — 40m
- [ ] Witness.witness_evolution_preserves_len — 35m
- [ ] Witness.witness_non_exhausted_evolves — 30m
- **Expected Result:** 14/61 → 17/61 (additional 5%)

### Phase 4: Final Bound (Optional)
- [ ] QLGFamily.algebraic_exhaustion_bound — 4-6h
- **Expected Result:** 17/61 → 18/61 (can be deferred)

---

## Build After Each Fix

After fixing each theorem, rebuild to confirm:

```bash
cd /c/Users/jessi/SNAPKITTYWEST/hyperkitty/formal
lake build

# Check sorry count dropped
grep -c "sorry" HyperKitty/*.lean QLGFamily.lean
```

---

## References for Implementation

### Lean 4 Tactics Cheat Sheet

| Tactic | Use Case |
|--------|----------|
| `simp [defs]` | Simplify using definitions |
| `ring` | Polynomial arithmetic (ℤ, ℚ, etc.) |
| `omega` | Linear arithmetic over ℤ |
| `norm_num` | Numerical computation |
| `decide` | Decidable computation |
| `cases` | Case analysis on inductive type |
| `induction` | Inductive proof |
| `rw [h]` | Rewrite using hypothesis |
| `exact` | Direct proof term |
| `have h : P := ...` | Introduce intermediate lemma |

### Common Patterns

**Proving a ∘ b = b ∘ a (commutativity):**
```lean
theorem commutative (a b : X) : mul a b = mul b a := by
  unfold mul
  constructor <;> ring  -- or norm_num / omega
```

**Exhaustive case analysis:**
```lean
theorem all_cases (g : Glyph) (P : Glyph → Prop) :
    ∀ g, P g := by
  intro g
  cases g <;> simp [P]  -- 6 branches automatically handled
```

**Existential witness:**
```lean
theorem exists_example : ∃ x : ℕ, x + 1 = 2 := by
  use 1
  rfl
```

---

## Testing Checklist

- [ ] All imports resolve
- [ ] `lake build` completes without error (warnings ok)
- [ ] No new sorry terms introduced
- [ ] Sorry count decreases monotonically
- [ ] Proof is understandable in 1 minute
- [ ] Matches mathematical statement in paper
- [ ] No circular dependencies
- [ ] Comments explain non-obvious steps

---

**Document Status:** Active  
**Next Review:** After completing Priority 1  
**Owner:** Ahmad Ali Parr / SNAPKITTYWEST Research Institute  
