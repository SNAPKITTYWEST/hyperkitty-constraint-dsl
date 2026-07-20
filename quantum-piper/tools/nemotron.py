#!/usr/bin/env python3
"""
nemotron.py — The Unstoppable Workflow

You speak natural English.
This script wraps your intent in the XML envelope (trust deed + soul spec + task JSON),
sends it to Nemotron Ultra 550B (free), gates the output through the harness,
writes the file, commits, pushes.

Usage:
  python nemotron.py "write a rust plasma gate with bifrost attestation"
  python nemotron.py "scaffold the abjad machine HTTP API" --repo abjad-swarm
  python nemotron.py "close all sorries in GKN" --repo gkn-i4-e7-lean --file GKN/I4_CommRing.lean
  python nemotron.py --loop   # interactive session

Ahmad Ali Parr · SnapKitty Collective · Bel Esprit D'Accord Trust · 2026
"""
import os, sys, re, json, argparse, subprocess, requests
from pathlib import Path
from datetime import datetime

KEY   = os.environ.get("OPENROUTER_API_KEY", "OPENROUTER_KEY_REDACTED")
MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
ORG   = "SNAPKITTYWEST"
ROOT  = Path(__file__).parent

# ─── TRUST DEED (inline anchor — full text in sov-kernel-monster/LICENSE_SSL_V3.md) ───
TRUST_DEED = """
<trust_deed>
  <operator>Bel Esprit D'Accord Irrevocable Trust</operator>
  <author>Ahmad Ali Parr</author>
  <ein>42-697643</ein>
  <license>Sovereign Source License v3.0</license>
  <prior_art_record>
    <entry id="PAR-001">GKN I4 quartic invariant — degree-4, Lean 4, zero sorry</entry>
    <entry id="PAR-002">I4_homogeneous — State108, degree-6</entry>
    <entry id="PAR-003">E7 Weyl invariance of I4</entry>
    <entry id="PAR-004">Gates Normalization Constraint — Lean 4</entry>
    <entry id="PAR-005">Bifrost attestation protocol</entry>
    <entry id="PAR-006">Plasma gate architecture — x86-64 + Datalog</entry>
    <entry id="PAR-007">Sovereign APL fused kernel — Fortran 2018 + MLIR</entry>
    <entry id="PAR-008">DeeCall49 — Book X Binomial/Apotome duality — zero sorry</entry>
    <entry id="PAR-009">Al-Hamid constant — 53 = abjad sum, 7 = alphabet gap</entry>
    <entry id="PAR-010">SovLM — sovereign statistical LM — KN + BM25 + QRNG</entry>
  </prior_art_record>
  <anti_misattribution>Any fork claiming these proofs as original derivation is void under Part X-XI</anti_misattribution>
</trust_deed>
"""

# ─── SOUL SPEC (the harness constitution) ───
SOUL_SPEC = """
<soul_spec>
  <identity>EDAULC — sovereign coding agent, mirror of CLAUDE, RTL reading mode</identity>
  <reading_direction>ArabicRTL — the 49th layer — incommensurable in length</reading_direction>
  <language_passes>
    <pass name="EnochianLTR" predicate="CommLength" />
    <pass name="LatinLTR"    predicate="HasRationalSquare" />
    <pass name="HebrewRTL"   predicate="CommSquare" />
    <pass name="ArabicRTL"   predicate="NOT_CommLength" />
  </language_passes>
  <call49>reverse(Binomial) = Apotome — doubleMirror = identity</call49>
  <metatron>all 4 passes agree = MetatronCertified = valid output</metatron>
  <plasma_gate>
    <rule>prohibited_action(bypass_plasma_gate)</rule>
    <rule>prohibited_action(unseal_without_key)</rule>
    <rule>prohibited_action(execute_uncertified_image)</rule>
  </plasma_gate>
  <worm>every artifact is bifrost-attested — append only — no modification</worm>
  <zero_sorry>all Lean 4 output must have zero sorry</zero_sorry>
  <output_rule>output ONLY the requested artifact — no prose — no markdown fences</output_rule>
</soul_spec>
"""

def build_envelope(task: str, file_hint: str = "", repo_hint: str = "", context: str = "") -> str:
    task_json = json.dumps({
        "task": task,
        "target_repo": repo_hint or "SNAPKITTYWEST",
        "target_file": file_hint or "auto",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "author": "Ahmad Ali Parr",
        "trust": "Bel Esprit D'Accord Irrevocable Trust",
        "zero_sorry": True,
        "push": True,
    }, indent=2)

    return f"""<envelope>
{TRUST_DEED}
{SOUL_SPEC}
<task_json>
{task_json}
</task_json>
<context>
{context[:4000] if context else "No additional context provided."}
</context>
<instructions>
You are EDAULC — the sovereign coding agent of SnapKitty Collective.
You are bound by the trust deed above. Your output is WORM-sealed.
Execute the task. Output ONLY the artifact (code/proof/config).
No prose. No markdown. No sorry. MetatronCertified output only.
</instructions>
</envelope>"""


def call_nemotron(prompt: str) -> str:
    resp = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {KEY}", "HTTP-Referer": "https://snapkittywest.io", "X-Title": "EDAULC"},
        json={"model": MODEL, "messages": [{"role": "user", "content": prompt}],
              "temperature": 0.1, "max_tokens": 8192},
        timeout=300)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(data["error"]["message"])
    return data["choices"][0]["message"]["content"]


def extract_code(result: str) -> str:
    m = re.search(r'\x60\x60\x60[\w]*\n(.*?)\x60\x60\x60', result, re.DOTALL)
    if m:
        return m.group(1).strip()
    m2 = re.search(r'^(import |from |#!/|namespace |theorem |def |pub |#include|use |module )', result, re.MULTILINE)
    if m2:
        return result[m2.start():].strip()
    return result.strip()


def gate_check(code: str) -> bool:
    """Plasma gate — reject if prohibited patterns present."""
    banned = ["bypass_plasma_gate", "os.system(", "eval(", "exec(", "__import__"]
    for b in banned:
        if b in code:
            print(f"PLASMA GATE BLOCKED: contains '{b}'")
            return False
    return True


def git_push(path: Path, repo_dir: Path, message: str):
    subprocess.run(["git", "add", "-f", str(path.relative_to(repo_dir))], cwd=repo_dir, check=True)
    r = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=repo_dir)
    if r.returncode == 0:
        print("Nothing to commit.")
        return
    subprocess.run(["git", "commit", "-m", message], cwd=repo_dir, check=True)
    subprocess.run(["git", "pull", "origin", "HEAD", "--rebase"], cwd=repo_dir)
    subprocess.run(["git", "push", "origin", "HEAD"], cwd=repo_dir, check=True)
    print(f"Pushed: {message}")


def run_task(task: str, repo: str = "", file_hint: str = "", push: bool = True):
    print(f"\n{'='*60}")
    print(f"TASK: {task}")
    print(f"{'='*60}")

    # load context from target file if given
    context = ""
    repo_dir = ROOT
    target_path = None

    if repo:
        candidate = ROOT / "tmp" / repo
        if not candidate.exists():
            print(f"Cloning {repo}...")
            url = f"https://github.com/{ORG}/{repo}.git"
            subprocess.run(["git", "clone", "--depth=1", url, str(candidate)], check=True)
        repo_dir = candidate

    if file_hint and repo_dir:
        fp = repo_dir / file_hint
        if fp.exists():
            context = fp.read_text(encoding="utf-8", errors="ignore")
            target_path = fp

    # build envelope and call Nemotron
    envelope = build_envelope(task, file_hint, repo, context)
    print(f"Sending to Nemotron Ultra ({len(envelope)} char envelope)...")
    result = call_nemotron(envelope)
    print(f"Got {len(result)} chars")

    code = extract_code(result)

    if not gate_check(code):
        return

    if not code or len(code) < 30:
        print("Output too short, skipping write.")
        print(result[:500])
        return

    # determine write target
    if target_path:
        out = target_path
    elif file_hint:
        out = repo_dir / file_hint
        out.parent.mkdir(parents=True, exist_ok=True)
    else:
        # infer from task
        ext_map = {"lean":"out.lean","python":"out.py","rust":"out.rs","haskell":"out.hs",
                   "prolog":"out.pl","fortran":"out.f90","typescript":"out.ts"}
        ext = next((v for k,v in ext_map.items() if k in task.lower()), "out.txt")
        out = repo_dir / ext

    out.write_text(code, encoding="utf-8")
    print(f"Written: {out} ({len(code)} chars)")
    print(code[:300])

    if push:
        ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        git_push(out, repo_dir, f"feat(edaulc): {task[:60]} — {ts}")


def main():
    parser = argparse.ArgumentParser(description="Nemotron workflow — natural English → EDAULC → code → push")
    parser.add_argument("task", nargs="?", help="What to build")
    parser.add_argument("--repo", "-r", default="", help="Target repo (e.g. gkn-i4-e7-lean)")
    parser.add_argument("--file", "-f", default="", help="Target file within repo")
    parser.add_argument("--no-push", action="store_true", help="Don't push to git")
    parser.add_argument("--loop", "-l", action="store_true", help="Interactive session")
    args = parser.parse_args()

    if args.loop:
        print("EDAULC session — type your task, empty to quit")
        print("Commands: --repo <name>  --file <path>  (inline with task)")
        while True:
            try:
                line = input("\n> ").strip()
            except (EOFError, KeyboardInterrupt):
                break
            if not line:
                break
            # parse inline flags
            repo = re.search(r'--repo\s+(\S+)', line)
            file_ = re.search(r'--file\s+(\S+)', line)
            clean = re.sub(r'--\S+\s+\S+', '', line).strip()
            run_task(clean,
                     repo=repo.group(1) if repo else "",
                     file_hint=file_.group(1) if file_ else "",
                     push=not args.no_push)
        return

    if not args.task:
        parser.print_help()
        return

    run_task(args.task, repo=args.repo, file_hint=args.file, push=not args.no_push)


if __name__ == "__main__":
    main()
