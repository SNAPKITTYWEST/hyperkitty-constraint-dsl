# TOM Sovereign Swarm — How To Run

## Key fact
Models run on Ollama's cloud servers. Your machine only sends HTTP requests.
10 parallel agents = 10 tiny async HTTP calls. Zero local GPU/CPU.
The IDE bogs down from rendering — run swarms in PowerShell, not the IDE.

## Setup (one time)

```powershell
cd C:\Users\jessi\Documents\GitHub\twin-o-matic
# load env vars
$env:OLLAMA_URL      = "https://ollama.com"
$env:OLLAMA_API_KEY  = "your_rotated_key_here"
$env:TOM_OUTER_MODEL = "qwen3-coder:480b"
```

Or put them in `.env` and load with:
```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') { [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') }
}
```

## Run a swarm

```powershell
# 10 models, 5 generations — serious run
python tom.py --task "your task here" --generations 5 --swarm-size 10

# Fast probe — 4 models, 1 gen
python tom.py --task "your task here" --generations 1 --swarm-size 4

# Pick specific models
python tom.py --task "..." --models "nemotron-3-ultra,qwen3-coder:480b,devstral-2:123b"
```

## Run multiple swarms in parallel (PowerShell)

```powershell
# Fire 3 swarms on different tasks simultaneously
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\jessi\Documents\GitHub\twin-o-matic'; python tom.py --task 'prove I4 symplectic invariance in Lean 4' --generations 3 --swarm-size 6"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\jessi\Documents\GitHub\twin-o-matic'; python tom.py --task 'write zero-sorry Lean 4 zeta function lemma' --generations 3 --swarm-size 6"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\jessi\Documents\GitHub\twin-o-matic'; python tom.py --task 'write ANS Forth double-number test suite' --generations 3 --swarm-size 6"
```
Each opens its own window. Each fires 6 models. 18 total parallel model calls. Zero local compute.

## Fleet available (31 models)

| Model | Best for | Speed |
|-------|---------|-------|
| `nemotron-3-ultra` | Complex reasoning, Lean 4 | slow |
| `qwen3-coder:480b` | Code, proofs, outer loop | medium |
| `devstral-2:123b` | Code generation | fast |
| `deepseek-v4-flash` | Quick drafts | fast |
| `gpt-oss:120b` | General reasoning | medium |
| `nemotron-3-super` | Math, proofs | medium |
| `kimi-k2.7-code` | Code tasks | fast |
| `ministral-3:3b` | Ultra fast smoke test | very fast |
| `gemma3:27b` | General | medium |
| `deepseek-v4-pro` | Deep reasoning (slow auth) | slow |

## Swarm sizes

| Size | Models fired | Wall time (approx) | Use case |
|------|-----------|--------------------|---------|
| 3 | fast trio | 10-30s | quick test |
| 6 | default | 30-90s | standard run |
| 10 | full top fleet | 60-120s | serious task |
| 20+ | all models | 60-120s | same — all async |

Above 10 you hit diminishing returns. 6-10 is the sweet spot.

## What Qwen does vs what Claude does

| Task | Who does it |
|------|------------|
| Code generation, proofs, math | Qwen / swarm (curl or TOM) |
| GitHub push, PR, repo create | Claude (gh CLI auth) |
| HuggingFace upload | Claude (OAuth token) |
| WORM chain anchoring | Claude pushes, swarm generates |
| RSI outer loop analysis | qwen3-coder:480b via TOM |

## WORM output

Every generation is sealed to `worm/chain.jsonl`.
Each entry has: best model, success, tokens, failure class, SHA-256 seal.
This is the audit trail — never delete it.

## Current swarm record

- Max models fired simultaneously: 10
- Consistent winners: nemotron-3-ultra, qwen3-coder:480b, devstral-2:123b
- Consistent failures (auth issues): deepseek-v4-pro, kimi-k2.7-code, mistral-large-3:675b
- Lesson extracted gen 3: "Symplectic swap invariance follows from trace commutativity and ring commutativity"
