# Origin

The HyperKittyConstraintDSL was written on a phone via Termux on 2026-08-02.
It is the predecessor to the formal QRA/SLA/QLG algebra proved in Lean 4.

## Genesis

The genesis C bus struct:
```c
typedef struct {
    char type[32]; char from[64]; char to[64];
    char topic[128]; uint64_t corr; char body[8192];
} hk_message_t;
// thread-per-conn, queue 256, crash-isolation
```

`uint64_t corr` became `omega` in SLA.
`queue 256` became the entropy gate H <= 0.20.
`crash-isolation` became R(Lambda) = 0 (balance prevents propagation).

## What This Repo Contains

- The DSL specification that was designed before the algebra
- The K3 surface entropy checker (first geometric object the DSL rejects)
- The BH mechanics verified toolchain (Fortran+Janet+Coq+C)
- The XSLT meta-programming architecture (JSON+XML+SGML -> bash)

## Prior Art Statement

These files establish that the core architectural concepts (deterministic
routing, entropy-bounded messages, NAND-complete constraint kernel,
correlation-ID invariant) were conceived and implemented on 2026-08-02,
six generations before their formal mathematical proof in Lean 4.

*SNAPKITTYWEST · Bel Esprit D'Accord Irrevocable Trust · 2026*
