# Twin-O-Matic (TOM) — Recursive Self-Improvement Loop

![Outer Loop](https://img.shields.io/badge/Loop-Outer%20Architect-7A3EFF?style=for-the-badge)
![Inner Loop](https://img.shields.io/badge/Loop-Inner%20Worker-0B5FFF?style=for-the-badge)
![Audit](https://img.shields.io/badge/Audit-WORM%20Chain-0A7F3F?style=for-the-badge)
![Runtime](https://img.shields.io/badge/Runtime-Ollama%20Compatible-222222?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-0f766e?style=for-the-badge)
![Docs](https://img.shields.io/badge/docs-user%20guide%20%7C%20hardening-334155?style=for-the-badge)

**Outer Loop rewrites Inner Loop. Inner Loop executes. WORM chain seals every generation.**

![Architecture](docs/architecture.svg)

## Guides

- [User guide](docs/USER_GUIDE.md)
- [Production hardening](docs/PRODUCTION_HARDENING.md)

Built on the SnapKitty sovereign infrastructure. The digital twin "gates" concept applied to meta-optimization.

```
OUTER LOOP (Architect)        — analyzes telemetry, rewrites inner prompt + hyperparams
      ↓
INNER LOOP (Worker)           — executes task under gate constraints
      ↓
ASSERT GATE                   — validates outer output before promotion (no entropy collapse)
      ↓
WORM CHAIN                    — seals every generation immutably
```

## What The Repo Is For

`Twin-O-Matic` is a controlled meta-optimization loop.

The repo exists to answer one practical question:

How much can a constrained outer loop improve a task-executing inner loop before the system starts destabilizing itself?

That is why the assert gate and WORM chain matter. They keep the repo honest when the outer loop starts editing the worker.

## Quick Start

```bash
# Set models (default: nemotron via Ollama)
export TOM_OUTER_MODEL=nemotron
export TOM_INNER_MODEL=nemotron
export OLLAMA_URL=http://localhost:11434

# Run 5 generations on a task
python tom.py --task "write an optimized Python merge sort" --generations 5

# Debug: inner loop only, no outer rewriting
python tom.py --task "prove x^2 >= 0" --generations 3 --inner-only
```

## Architecture

| Component | File | Role |
|-----------|------|------|
| Outer Loop prompt | `prompts/outer_loop.txt` | Architect — rewrites inner |
| Inner Loop prompt | `prompts/inner_loop.txt` | Worker — executes tasks |
| Outer output schema | `schemas/outer_output_schema.json` | Assert gate schema |
| Hyperparams schema | `schemas/hyperparams_schema.json` | Gate config |
| Runtime | `tom.py` | Orchestrator |
| State | `state/` | Live prompt + hyperparams + lessons |
| WORM chain | `worm/chain.jsonl` | Immutable generation audit |

## The Gate Taxonomy

| Gate | Mechanism | Effect |
|------|-----------|--------|
| Assert gate | JSON schema validation before promotion | Prevents entropy collapse |
| Temperature gate | Outer loop adjusts 0.0–2.0 | CLASS_A (logic fail) → lower; CLASS_B (creative fail) → raise |
| Logit bias gate | Per-token suppression/boost | Bans recursive failure patterns |
| Lesson register | Compressed state file (50 entries max) | 16x context compression |

## Failure Classes

| Class | Condition | Outer Loop Response |
|-------|-----------|---------------------|
| A | Logic / coding failure | Lower temperature, tighten logit gates |
| B | Creative / open-ended failure | Raise temperature, open gates |
| C | Context overflow | Compress lesson register, trim prompt |
| D | Schema violation | Repair prompt structure |
| PASS | Success | No changes — continue |

## Connection to Gates Normalization

The logit bias gate is `G_P(D_M) = softmax(logits_M + b_P)` — the same
formalism as the Gates Normalization paper. The outer loop is dynamically
computing `b_P` from telemetry. The simplex constraint holds across all
generations: ∑P = 1.

## Sovereign Infrastructure

- Models: `Snapkitty/snapkitty-nemotron` (gate model) + `Snapkitty/snapkitty-harness` (syscall gate)
- WORM: `worm/chain.jsonl` — SHA-256 sealed, append-only
- License: MIT
