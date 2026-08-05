# Connection: Constraint DSL -> QRA/SLA/QLG Tripartite Isomorphism

## The Intellectual Chain

The HyperKittyConstraintDSL was written **before** the formal algebra existed.
It contains the same mathematical structure in a different representation.

## DSL to Algebra Mapping

| DSL Concept | Formal Algebra | Notes |
|---|---|---|
| `NAND(a,b) = 1 - a*b` | QRA Boolean primitive | NAND-complete = one gate closes all routing |
| `entropy(agent) <= 0.20` | H = 0 nats (QRA) | 0.20 is the soft bound; QRA achieves H=0 exactly |
| `active(a) => trusted(a)` | `isBalanced(x)` in QLG | Both enforce the invariant structurally |
| `V(l_i) = dA+dE == dL+dR` | R(Lambda) = delta + iota = 0 | Same balance axiom, different notation |
| `uint64_t corr` in C bus | omega in SLA | The conserved quantity across transitions |
| DAG edges (StateSpace->LedgerLog->...) | QRA routing path Pi->Gamma->Delta->Omega | The glyph path IS the DAG path |
| `WORM_Chain` commit | Omega (Conclusio) terminal glyph | Commit = reaching the absorbing state |
| ReconciliationProtocol phases | SLA evolution steps | Audit->Balance->Invariant->Commit = step sequence |

## The K3 Result

The K3 surface Hodge number distribution has entropy H = 0.831 nats.

This **violates** the DSL entropy bound H <= 0.20. The HOL Light proof in
`hol/k3_entropy.ml` establishes this formally. This makes K3 surfaces the
first concrete geometric objects that the constraint system formally rejects.

In the QRA formalism: a K3 surface cannot be routed through the tensor
because Q[6][6] has H=0 — it rejects any input distribution with H > 0.
The K3 Hodge distribution has H = 0.831, so it routes to the entropy gate
and is rejected at the C bus: `hk_msg_valid(m)` returns false when
`m->entropy_x100 > 20`.

## The DSL Predates the Algebra

Genesis commit: 2026-08-02T19:43:38Z (f3c7ebc8)
DSL constraint specification: same day
QRA tensor formalized: 2026-08-04
SLA algebra formalized: 2026-08-04
QLG Lean 4 proofs: 2026-08-04

The DSL is the proto-algebra. The algebra is the formal proof of what the DSL asserted.

## Paper Citation

```bibtex
@misc{parr2026dsl,
  author = {Ahmad Parr and SNAPKITTYWEST},
  title  = {HyperKittyConstraintDSL: A Deterministic Constraint Kernel for Sovereign Agent Systems},
  year   = {2026},
  url    = {https://github.com/SNAPKITTYWEST/hyperkitty-constraint-dsl},
  note   = {Genesis: 2026-08-02, Zenodo DOI pending}
}
```
