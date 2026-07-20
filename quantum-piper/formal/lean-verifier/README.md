# lean-llm-starter

![Lean 4](https://img.shields.io/badge/Lean-4.13.0-0B5FFF?style=for-the-badge)
![mathlib](https://img.shields.io/badge/mathlib-v4.13.0-1E824C?style=for-the-badge)
![Harness](https://img.shields.io/badge/Harness-Deterministic-222222?style=for-the-badge)
![Parser](https://img.shields.io/badge/Granite-JSON%20Schema-7A3EFF?style=for-the-badge)
![Eval](https://img.shields.io/badge/MiniF2F-Eval%20Ready-B36B00?style=for-the-badge)
![HF](https://img.shields.io/badge/Hugging%20Face-Ready-F7C948?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-0f766e?style=for-the-badge)

A deterministic Lean 4 verification harness that treats the LLM as an untrusted proposal engine and Lean 4 as the trusted kernel.

![Architecture](docs/architecture.svg)

## Core Loop

```text
operator intent
  -> Prolog gate
  -> Granite / Llemma proposal
  -> JSON schema validation
  -> Lean 4 parse and build
  -> verification result
  -> WORM-ready audit artifact
```

## Trust Split

- `inference/`
  Untrusted proposer surface.
- `logic/`
  Prolog guardrails and retry loop.
- `lean4/`
  Trusted verification kernel.
- `infra/verification-loop/`
  Deterministic container topology.
- `eval/`
  Benchmark harness for MiniF2F-style runs.

## Guides

- [Repo map](docs/REPO_MAP.md)
- [Quickstart](docs/QUICKSTART.md)
- [Operator guide](docs/OPERATOR_GUIDE.md)
- [Production hardening](docs/PRODUCTION_HARDENING.md)
- [Hugging Face publishing](docs/HUGGINGFACE_PUBLISHING.md)

## Repo Layout

```text
lean-llm-starter/
├── .github/workflows/ci.yml
├── .gitattributes
├── .gitignore
├── LICENSE
├── Makefile
├── README.md
├── docker-compose.yml
├── docs/
│   ├── architecture.svg
│   ├── HUGGINGFACE_PUBLISHING.md
│   ├── OPERATOR_GUIDE.md
│   ├── QUICKSTART.md
│   └── REPO_MAP.md
├── eval/
│   ├── requirements.txt
│   └── run_minif2f.py
├── fixtures/
│   └── sample_input.jsonl
├── hf/
│   └── README.md
├── inference/
│   ├── Dockerfile
│   ├── prompt.txt
│   ├── requirements.txt
│   └── server.py
├── infra/
│   └── verification-loop/
│       ├── .env.example
│       └── docker-compose.yml
├── lean4/
│   ├── lakefile.toml
│   ├── lean-toolchain
│   ├── MiniF2F.lean
│   ├── VerifyMain.lean
│   └── src/
├── logic/
│   ├── sovereign_verification.pl
│   └── verification_loop.pl
└── hf/
    └── README.md
```

## Verified State

- Lean project builds successfully on this machine
- parse-only mode succeeds on the sample JSONL fixture
- Python inference and eval files compile cleanly
- root `docker-compose.yml` and `Makefile` exist for bring-up

## Quick Commands

If `lake` is not on PATH on Windows, use:

```powershell
C:\Users\jessi\.elan\bin\lake.exe
```

Build Lean:

```bash
cd lean4
C:\Users\jessi\.elan\bin\lake.exe build
```

Parse smoke test:

```bash
cd lean4
C:\Users\jessi\.elan\bin\lake.exe exe verify -- --parse ../fixtures/sample_input.jsonl
```

Bring up inference:

```bash
cd inference
docker build -t lean-llm-inference .
docker run -d -p 8080:8080 --name lean-llm-inference lean-llm-inference
```

Bring up the verification loop:

```bash
docker compose --env-file infra/verification-loop/.env.example up -d granite-verifier
```

Run eval:

```bash
cd eval
pip install -r requirements.txt
python run_minif2f.py
```

## ASCII Overview

```text
             +--------------------+
             |  Operator Intent   |
             +---------+----------+
                       |
                       v
             +---------+----------+
             |   Prolog Gate      |
             | auth / schema /    |
             | syntax controls    |
             +---------+----------+
                       |
             +---------+----------+
             | Granite / Llemma   |
             | proposal engine    |
             +---------+----------+
                       |
                       v
             +---------+----------+
             | Granite4Parser     |
             | Lean-side decoder  |
             +---------+----------+
                       |
                       v
             +---------+----------+
             | Lean 4 Kernel      |
             | build / verify     |
             +---------+----------+
                       |
                       v
             +---------+----------+
             | audit artifacts    |
             | hf / worm / eval   |
             +--------------------+
```

## Hugging Face Readiness

This repository is already prepared for later Hugging Face publication with:

- `.gitattributes` for large model artifacts
- `hf/README.md` model-card starter
- `docs/HUGGINGFACE_PUBLISHING.md` publication checklist

Recommended publish modes:

1. code-only harness repo
2. model repo for GGUF or safetensors
3. Space repo for interactive theorem verification
