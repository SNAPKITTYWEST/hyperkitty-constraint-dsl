#!/usr/bin/env python3
"""
TOM — Twin-O-Matic: Sovereign Parallel Swarm
Outer Loop coordinates N inner agents running simultaneously across the fleet.
Each inner agent runs on a different model. Best result wins. WORM seals every gen.

Usage:
    python tom.py --task "prove x^2 >= 0 in Lean 4" --generations 5
    python tom.py --task "write bubble sort" --generations 3 --swarm-size 6
    python tom.py --task "..." --models nemotron-3-ultra,deepseek-v4-pro,kimi-k2.7-code

Env:
    OLLAMA_URL   — defaults to https://ollama.com
    OLLAMA_API_KEY — Bearer token for cloud Ollama
    TOM_OUTER_MODEL — model for outer loop (default: deepseek-v4-pro)
"""
import argparse
import asyncio
import hashlib
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

# Windows UTF-8 stdout
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Rich imports (demo mode only — imported lazily so non-demo runs have zero overhead)
def _rich():
    from rich.live import Live
    from rich.table import Table
    from rich.console import Console
    from rich.text import Text
    from rich import box
    return Live, Table, Console, Text, box

BASE  = Path(__file__).parent
STATE = BASE / "state"
WORM  = BASE / "worm"

OLLAMA_URL     = os.environ.get("OLLAMA_URL",      "https://ollama.com")
OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY",  "")
OUTER_MODEL    = os.environ.get("TOM_OUTER_MODEL", "deepseek-v4-pro")

# Default swarm fleet — ordered by reasoning quality
DEFAULT_FLEET = [
    "nemotron-3-ultra",
    "deepseek-v4-pro",
    "kimi-k2.7-code",
    "qwen3-coder:480b",
    "devstral-2:123b",
    "deepseek-v4-flash",
    "mistral-large-3:675b",
    "gpt-oss:120b",
    "nemotron-3-super",
    "qwen3-coder-next",
]


# ── HTTP ───────────────────────────────────────────────────────────────────────

def _call_ollama_sync(model: str, system_prompt: str, user_prompt: str,
                      temperature: float = 0.7, top_p: float = 0.9) -> str:
    payload = {
        "model": model,
        "system": system_prompt,
        "prompt": user_prompt,
        "stream": False,
        "options": {"temperature": temperature, "top_p": top_p}
    }
    data = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if OLLAMA_API_KEY:
        headers["Authorization"] = f"Bearer {OLLAMA_API_KEY}"
    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/generate",
        data=data, headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return json.loads(resp.read()).get("response", "")
    except Exception as e:
        return f"FAIL: model={model} error={e}"


async def call_ollama(model: str, system_prompt: str, user_prompt: str,
                      temperature: float = 0.7, top_p: float = 0.9) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, _call_ollama_sync, model, system_prompt, user_prompt, temperature, top_p
    )


# ── State ──────────────────────────────────────────────────────────────────────

def ensure_dirs():
    for d in [STATE, WORM]:
        d.mkdir(exist_ok=True)
    if not (STATE / "hyperparams.json").exists():
        (STATE / "hyperparams.json").write_text(json.dumps(
            {"temperature": 0.7, "top_p": 0.9, "logit_bias": {}, "max_tokens": 2048}, indent=2))
    if not (STATE / "telemetry.jsonl").exists():
        (STATE / "telemetry.jsonl").write_text("")
    if not (STATE / "lesson_register.json").exists():
        (STATE / "lesson_register.json").write_text(json.dumps({"lessons": [], "generation": 0}))


def load_state():
    inner_prompt = (BASE / "prompts" / "inner_loop.txt").read_text(encoding="utf-8")
    if (STATE / "inner_prompt.txt").exists():
        inner_prompt = (STATE / "inner_prompt.txt").read_text(encoding="utf-8")
    hyperparams = json.loads((STATE / "hyperparams.json").read_text(encoding="utf-8"))
    lines = (STATE / "telemetry.jsonl").read_text(encoding="utf-8").strip().splitlines()
    telemetry = [json.loads(l) for l in lines[-20:] if l.strip()]
    lessons = json.loads((STATE / "lesson_register.json").read_text(encoding="utf-8"))
    return inner_prompt, hyperparams, telemetry, lessons


# ── Inner swarm ────────────────────────────────────────────────────────────────

async def run_one_inner(model: str, task: str, inner_prompt: str,
                        hyperparams: dict, generation: int) -> dict:
    """Run one inner agent on one model. Returns telemetry entry."""
    t0 = time.time()
    response = await call_ollama(
        model, inner_prompt, task,
        temperature=hyperparams.get("temperature", 0.7),
        top_p=hyperparams.get("top_p", 0.9),
    )
    elapsed = time.time() - t0
    success = "FAIL:" not in response and len(response) > 20
    lesson  = next((l[7:].strip() for l in response.splitlines() if l.startswith("LESSON:")), "")
    return {
        "generation": generation,
        "model": model,
        "task": task[:100],
        "success": success,
        "tokens": len(response.split()),
        "lesson": lesson,
        "elapsed": round(elapsed, 1),
        "ts": int(time.time()),
        "response": response,
    }


async def run_swarm(task: str, fleet: list[str], inner_prompt: str,
                    hyperparams: dict, generation: int) -> list[dict]:
    """Run all fleet models in parallel. Returns list of telemetry entries."""
    print(f"  [swarm] firing {len(fleet)} agents in parallel...")
    tasks = [run_one_inner(m, task, inner_prompt, hyperparams, generation) for m in fleet]
    results = await asyncio.gather(*tasks)
    return list(results)


def pick_best(results: list[dict]) -> dict:
    """Pick best result: prefer success + most tokens (most complete answer)."""
    successes = [r for r in results if r["success"]]
    pool = successes if successes else results
    return max(pool, key=lambda r: r["tokens"])


def _demo_table(fleet, states, generation, total_gens, task):
    """Build a Rich table snapshot from current agent states."""
    Live, Table, Console, Text, box = _rich()
    table = Table(
        title=f"[bold cyan]TOM — Sovereign Parallel Swarm[/bold cyan]  "
              f"[dim]gen {generation}/{total_gens}[/dim]\n"
              f"[dim]task: {task[:72]}[/dim]",
        box=box.HEAVY_EDGE,
        border_style="bright_blue",
        show_lines=True,
        min_width=90,
    )
    table.add_column("Model", style="bold white", min_width=28)
    table.add_column("Status", justify="center", min_width=10)
    table.add_column("Tokens", justify="right", min_width=8)
    table.add_column("Time", justify="right", min_width=8)
    table.add_column("Lesson", min_width=30)

    for model in fleet:
        s = states.get(model, {})
        status_val = s.get("status", "waiting")
        tokens     = s.get("tokens", 0)
        elapsed    = s.get("elapsed", 0.0)
        lesson     = s.get("lesson", "")

        if status_val == "waiting":
            status_text = Text("◌ waiting", style="dim")
        elif status_val == "running":
            status_text = Text("⟳ running", style="bold yellow")
        elif status_val == "done":
            success = s.get("success", False)
            status_text = Text("✓ done", style="bold green") if success else Text("✗ done", style="bold red")
        elif status_val == "best":
            status_text = Text("★ BEST", style="bold magenta")
        else:
            status_text = Text(status_val, style="dim")

        time_str   = f"{elapsed:.1f}s" if elapsed else "—"
        token_str  = str(tokens)       if tokens  else "—"
        lesson_str = (lesson[:35] + "…") if len(lesson) > 36 else lesson

        table.add_row(model, status_text, token_str, time_str, lesson_str)

    return table


async def run_swarm_demo(task, fleet, inner_prompt, hyperparams, generation, total_gens):
    """Demo-mode swarm: fires all agents in parallel with live Rich table."""
    Live, Table, Console, Text, box = _rich()
    console = Console()
    states  = {m: {"status": "waiting"} for m in fleet}

    async def run_one_tracked(model):
        states[model]["status"] = "running"
        result = await run_one_inner(model, task, inner_prompt, hyperparams, generation)
        states[model].update({
            "status":  "done",
            "tokens":  result["tokens"],
            "elapsed": result["elapsed"],
            "lesson":  result["lesson"],
            "success": result["success"],
        })
        return result

    with Live(
        _demo_table(fleet, states, generation, total_gens, task),
        console=console, refresh_per_second=4, screen=False
    ) as live:
        agent_tasks = [asyncio.create_task(run_one_tracked(m)) for m in fleet]
        while not all(t.done() for t in agent_tasks):
            await asyncio.sleep(0.25)
            live.update(_demo_table(fleet, states, generation, total_gens, task))
        results = [t.result() for t in agent_tasks]
        # mark best
        best = pick_best(results)
        states[best["model"]]["status"] = "best"
        live.update(_demo_table(fleet, states, generation, total_gens, task))
        await asyncio.sleep(1.2)   # hold the final frame so camera catches it

    return results


def log_telemetry(results: list[dict]):
    with open(STATE / "telemetry.jsonl", "a") as f:
        for r in results:
            entry = {k: v for k, v in r.items() if k != "response"}
            f.write(json.dumps(entry) + "\n")


# ── Outer loop ─────────────────────────────────────────────────────────────────

def assert_gate(patch_text: str):
    try:
        data = json.loads(patch_text)
        required = {"generation", "failure_class", "analysis", "inner_prompt_patch",
                    "hyperparams", "worm_note"}
        if not required.issubset(data.keys()):
            return False, f"missing keys: {required - data.keys()}"
        if data.get("failure_class") not in ("A", "B", "C", "D", "PASS"):
            return False, f"invalid failure_class: {data.get('failure_class')}"
        t = data.get("hyperparams", {}).get("temperature", -1)
        if not (0.0 <= t <= 2.0):
            return False, f"temperature out of range: {t}"
        return True, data
    except json.JSONDecodeError as e:
        return False, f"json parse: {e}"


async def run_outer(task: str, best_result: dict, inner_prompt: str,
                    hyperparams: dict, telemetry: list, lessons: dict,
                    generation: int, all_results: list[dict]):
    outer_system = (BASE / "prompts" / "outer_loop.txt").read_text(encoding="utf-8")
    schema = json.loads((BASE / "schemas" / "outer_output_schema.json").read_text(encoding="utf-8"))

    swarm_summary = [
        {"model": r["model"], "success": r["success"],
         "tokens": r["tokens"], "elapsed": r["elapsed"], "lesson": r["lesson"]}
        for r in all_results
    ]

    user_msg = json.dumps({
        "task": task,
        "generation": generation,
        "current_inner_prompt": inner_prompt[:500],
        "current_hyperparams": hyperparams,
        "best_model": best_result["model"],
        "best_success": best_result["success"],
        "swarm_results": swarm_summary,
        "recent_telemetry": telemetry[-5:],
        "lessons": lessons.get("lessons", [])[-10:],
        "instruction": "Analyze swarm results. Output JSON matching schema exactly.",
        "schema": schema,
    }, indent=2)

    print(f"  [outer] analyzing swarm (best: {best_result['model']})...")
    raw = await call_ollama(OUTER_MODEL, outer_system, user_msg, temperature=0.3)

    j_start = raw.find("{")
    j_end   = raw.rfind("}") + 1
    if j_start == -1:
        return None, "no JSON in outer response"
    ok, result = assert_gate(raw[j_start:j_end])
    if not ok:
        return None, f"assert gate: {result}"
    return result, None


def apply_patch(patch: dict):
    new_prompt = patch.get("inner_prompt_patch", "").strip()
    if new_prompt and len(new_prompt) > 20:
        (STATE / "inner_prompt.txt").write_text(new_prompt, encoding="utf-8")
    new_hp = patch.get("hyperparams", {})
    if new_hp:
        (STATE / "hyperparams.json").write_text(json.dumps(new_hp, indent=2), encoding="utf-8")
    lessons = json.loads((STATE / "lesson_register.json").read_text(encoding="utf-8"))
    note = patch.get("worm_note", "")
    if note:
        lessons["lessons"].append({"gen": patch["generation"], "note": note})
        lessons["lessons"] = lessons["lessons"][-50:]
    lessons["generation"] = patch["generation"]
    (STATE / "lesson_register.json").write_text(json.dumps(lessons, indent=2), encoding="utf-8")


# ── WORM ───────────────────────────────────────────────────────────────────────

def worm_seal(generation: int, patch, best_result: dict, swarm_size: int):
    record = {
        "generation": generation,
        "best_model": best_result["model"],
        "best_success": best_result["success"],
        "best_tokens": best_result["tokens"],
        "swarm_size": swarm_size,
        "failure_class": patch.get("failure_class", "?") if patch else "?",
        "worm_note": patch.get("worm_note", "") if patch else "inner_only",
        "ts": int(time.time()),
    }
    content = json.dumps(record, sort_keys=True)
    record["seal"] = hashlib.sha256(content.encode()).hexdigest()
    with open(WORM / "chain.jsonl", "a") as f:
        f.write(json.dumps(record) + "\n")
    print(f"  [worm] gen {generation} sealed: {record['seal'][:16]}… "
          f"(best={best_result['model']}, success={best_result['success']})")


# ── Main ───────────────────────────────────────────────────────────────────────

async def main_async(args):
    ensure_dirs()

    fleet = DEFAULT_FLEET[:args.swarm_size]
    if args.models:
        fleet = [m.strip() for m in args.models.split(",")]

    if args.demo:
        Live, Table, Console, Text, box = _rich()
        console = Console()
        console.print(f"\n[bold cyan]TOM[/bold cyan] — [bold]Sovereign Parallel Swarm[/bold]")
        console.print(f"[dim]Fleet ({len(fleet)}):[/dim] {', '.join(fleet)}")
        console.print(f"[dim]Endpoint:[/dim]  {OLLAMA_URL}")
        console.print(f"[dim]Outer:[/dim]     {OUTER_MODEL}\n")
    else:
        print(f"\nTOM - Sovereign Parallel Swarm")
        print(f"Task:        {args.task}")
        print(f"Generations: {args.generations}")
        print(f"Fleet ({len(fleet)}): {', '.join(fleet)}")
        print(f"Outer:       {OUTER_MODEL}")
        print(f"Endpoint:    {OLLAMA_URL}\n")

    for gen in range(1, args.generations + 1):
        print(f"=== Generation {gen}/{args.generations} ===")
        inner_prompt, hyperparams, telemetry, lessons = load_state()

        # fire swarm
        if args.demo:
            all_results = await run_swarm_demo(
                args.task, fleet, inner_prompt, hyperparams, gen, args.generations)
        else:
            all_results = await run_swarm(args.task, fleet, inner_prompt, hyperparams, gen)
        log_telemetry(all_results)

        # report (skipped in demo — table already showed it)
        if not args.demo:
            for r in sorted(all_results, key=lambda x: x["tokens"], reverse=True):
                status = "✓" if r["success"] else "✗"
                print(f"  {status} {r['model']:<30} tokens={r['tokens']:>5}  t={r['elapsed']}s")

        best = pick_best(all_results)
        print(f"  → best: {best['model']} (success={best['success']}, tokens={best['tokens']})")
        if best.get("lesson"):
            print(f"  → lesson: {best['lesson']}")

        # outer loop
        patch = None
        if not args.inner_only and gen < args.generations:
            patch, err = await run_outer(
                args.task, best, inner_prompt, hyperparams,
                telemetry, lessons, gen, all_results
            )
            if err:
                print(f"  [outer] error: {err} — skipping patch")
            else:
                print(f"  [outer] failure_class={patch['failure_class']}")
                apply_patch(patch)

        worm_seal(gen, patch, best, len(fleet))
        print()

    print("TOM complete. WORM chain sealed.")
    chain = list(open(WORM / "chain.jsonl"))
    print(f"Generations sealed: {len(chain)}")

    # print best final output
    print("\n=== BEST FINAL OUTPUT ===")
    inner_prompt, hyperparams, _, _ = load_state()
    final = await run_swarm(args.task, fleet[:3], inner_prompt, hyperparams, 999)
    best_final = pick_best(final)
    print(f"Model: {best_final['model']}")
    print(best_final["response"][:2000])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--task",        required=True)
    parser.add_argument("--generations", type=int, default=5)
    parser.add_argument("--swarm-size",  type=int, default=6,
                        help="How many models to run in parallel (default 6)")
    parser.add_argument("--models",      default="",
                        help="Comma-separated model list (overrides swarm-size)")
    parser.add_argument("--inner-only",  action="store_true")
    parser.add_argument("--demo",        action="store_true",
                        help="Live Rich table UI — every agent row lights up as it fires")
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
