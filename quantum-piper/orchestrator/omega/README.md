# Ω Vortex Agent Civilization

Sovereign multi-agent IDE frontend wired into quantum-piper.

## Components

| File | Role |
|---|---|
| `index.html` | Runnable IDE entry point — open directly in browser |
| `omega-chat.js` | `OmegaInfinityChat` Web Component + `OmegaSocket` WebSocket wrapper |
| `omega-chat.css` | Vortex civilization CSS — IBM Plex Mono, conic-gradient orbits, scan-line |
| `server.example.mjs` | Node.js WebSocket adapter → vLLM/Granite streaming endpoint |
| `agents.json` | 14-agent civilization registry (CARTO, RESONANCE, FORGE, GRANITE, ROBOB…) |
| `PROTOCOL.md` | `omega.chat.v1` WebSocket protocol spec |
| `omega-field.mjs` | GitHub Actions entropy field scanner + WORM-sealed README patcher |
| `omega_bottom.rexx` | REXX-generated shell panel CSS/HTML with guarded command executor |

## Agents (core roles)

- **Granite Orchestrator** — head router
- **Granite Shell** — Bash, POSIX sh, REXX, PowerShell, Nushell
- **CSS Painter** — CSS, HTML, SVG, motion UI
- **Fortran Forger** — Fortran, OpenMP, MPI, HPC
- **Javascripteer** — JS, TS, WebSockets, Web Components
- **NASM Smith** — x86-64, AArch64, RISC-V, bare metal
- **Lean Court** — Lean 4, Agda, Coq, Isabelle
- **Logic Warden** — Prolog, Datalog, ASP
- **Array Seer** — APL, J, BQN, K, Q, Julia, R
- **Systems Architect** — Ada/SPARK, Zig, Rust, OCaml, Haskell

## Wire into quantum-piper pipeline

```
quantum-piper/orchestrator/omega/server.example.mjs
  ↓ WebSocket omega.chat.v1
quantum-piper/orchestrator/omega/omega-chat.js  (browser Web Component)
  ↓ XML mission parsing
quantum-piper/kernels/*  (Fortran/CUDA/Rust kernels)
  ↓ formal gate
quantum-piper/formal/lean/SovereignGate.lean
  ↓ WORM attestation
quantum-piper/orchestrator/core/bob.mjs
```

## Run

```bash
cd quantum-piper/orchestrator/omega
node server.example.mjs   # starts ws://localhost:8787
# open index.html in browser
```
