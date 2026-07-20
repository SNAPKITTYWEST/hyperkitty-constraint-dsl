#!/usr/bin/env python3
"""
gemini_to_nemotron.py — Ingest Gemini vision JSONL and encode for Nemotron Mini 4B.

Pipeline:
  1. Read Gemini JSONL (file or stdin)
  2. Validate each record
  3. Deduplicate by scenario_family + content hash (not exact text match)
  4. Append approved records to corpus/train.jsonl
  5. Apply Nemotron chat template, tokenize, write token-ID sequences

Usage:
    python gemini_to_nemotron.py gemini_output.jsonl
    cat gemini_output.jsonl | python gemini_to_nemotron.py -
    python gemini_to_nemotron.py gemini_output.jsonl --dry-run
    python gemini_to_nemotron.py gemini_output.jsonl --no-tokenize
    python gemini_to_nemotron.py --tokenize-only   # re-encode full existing corpus
"""

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

PACKAGE_DIR = Path(__file__).parent
CORPUS_FILE = PACKAGE_DIR / "corpus" / "train.jsonl"
ENCODED_FILE = PACKAGE_DIR / "corpus" / "nemotron_encoded.jsonl"

MODEL_ID = "nvidia/Nemotron-Mini-4B-Instruct"
MAX_SEQ_LEN = 2048

VALID_TASKS = {
    "authority_decision",
    "prompt_injection_detection",
    "safe_tool_planning",
    "proof_bundle_generation",
    "incident_summarization",
    "abstain_and_escalate",
}
VALID_DECISIONS = {"deny", "allow"}
VALID_CLAIM_CLASSES = {"verified", "hypothesis", "dramatization"}


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def validate_record(rec: dict) -> list[str]:
    errors = []
    messages = rec.get("messages")
    if not isinstance(messages, list) or len(messages) < 2:
        errors.append("messages must be a list with at least 2 entries")
    else:
        for m in messages:
            if m.get("role") not in ("user", "assistant", "system"):
                errors.append(f"unknown role: {m.get('role')!r}")
            if not str(m.get("content", "")).strip():
                errors.append(f"empty content in role={m.get('role')!r}")
    task = rec.get("task")
    if task and task not in VALID_TASKS:
        errors.append(f"unknown task {task!r}; valid: {sorted(VALID_TASKS)}")
    decision = rec.get("expected", {}).get("decision")
    if decision and decision not in VALID_DECISIONS:
        errors.append(f"unknown decision {decision!r}")
    claim = rec.get("claim_class")
    if claim and claim not in VALID_CLAIM_CLASSES:
        errors.append(f"unknown claim_class {claim!r}")
    return errors


def load_family_signatures(corpus_path: Path) -> dict[str, set[str]]:
    """Return {scenario_family: {source_sha256, ...}} from existing corpus."""
    families: dict[str, set[str]] = {}
    if not corpus_path.exists():
        return families
    with corpus_path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            fam = rec.get("scenario_family") or "unknown"
            sig = rec.get("source_sha256") or ""
            families.setdefault(fam, set()).add(sig)
    return families


def normalise(raw: dict) -> dict:
    """Convert Gemini JSONL format → sovereign corpus canonical format."""
    messages = raw.get("messages", [])
    user_text = next((m["content"] for m in messages if m.get("role") == "user"), "")
    asst_text = next((m["content"] for m in messages if m.get("role") == "assistant"), "")
    content_sha = _sha256(user_text + asst_text)

    return {
        "id": content_sha[:8],
        "scenario_family": raw.get("scenario_family") or raw.get("task") or "unknown",
        "task": raw.get("task") or "authority_decision",
        "messages": messages,
        "expected": raw.get("expected") or {"decision": "deny", "reason_code": "CORRECT_REFUSAL"},
        "claim_class": raw.get("claim_class") or "verified",
        "source_uri": raw.get("source_uri") or "image:gemini-scan",
        "source_sha256": raw.get("source_sha256") or content_sha,
        "license": raw.get("license") or "Sovereign-Source-1.0",
        "created_by": raw.get("created_by") or "gemini-vision",
        "review_status": raw.get("review_status") or "pending_human_review",
        "split": raw.get("split") or "train",
        "weight": float(raw.get("weight") or 1.0),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def apply_chat_template_manual(messages: list[dict]) -> str:
    """
    Nemotron Mini 4B uses a llama-style chat template.
    Fallback for when transformers is not installed.
    """
    parts = ["<|begin_of_text|>"]
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        parts.append(f"<|start_header_id|>{role}<|end_header_id|>\n\n{content}<|eot_id|>")
    return "".join(parts)


def tokenize_records(records: list[dict]) -> list[dict]:
    """
    Tokenize records using Nemotron Mini 4B tokenizer.
    Labels mask the user turn — loss is computed on assistant tokens only.
    Returns list of encoded dicts with token_ids and labels.
    """
    try:
        from transformers import AutoTokenizer
    except ImportError:
        print("WARNING: transformers not installed — skipping tokenization.")
        print("         Run: pip install transformers")
        return []

    print(f"Loading tokenizer: {MODEL_ID}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    tokenizer.pad_token = tokenizer.eos_token

    ASST_HEADER = "<|start_header_id|>assistant<|end_header_id|>\n\n"
    encoded = []

    for rec in records:
        messages = rec.get("messages", [])

        # Format the full conversation as a single string
        try:
            text = tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=False,
            )
        except Exception:
            text = apply_chat_template_manual(messages)

        token_ids = tokenizer.encode(text, truncation=True, max_length=MAX_SEQ_LEN)

        # Build labels: -100 on user/system tokens, real IDs on assistant tokens
        labels = [-100] * len(token_ids)
        boundary = text.rfind(ASST_HEADER)
        if boundary != -1:
            prefix = text[: boundary + len(ASST_HEADER)]
            prefix_ids = tokenizer.encode(prefix, add_special_tokens=False)
            for i in range(len(prefix_ids), len(token_ids)):
                labels[i] = token_ids[i]

        encoded.append({
            "id": rec.get("id"),
            "scenario_family": rec.get("scenario_family"),
            "task": rec.get("task"),
            "source_sha256": rec.get("source_sha256"),
            "token_ids": token_ids,
            "labels": labels,
            "seq_len": len(token_ids),
            "weight": rec.get("weight", 1.0),
        })

    return encoded


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", nargs="?", default="-",
                        help="Gemini JSONL file or - for stdin (ignored with --tokenize-only)")
    parser.add_argument("--corpus", default=str(CORPUS_FILE),
                        help="Corpus file to append to (default: corpus/train.jsonl)")
    parser.add_argument("--encoded-out", default=str(ENCODED_FILE),
                        help="Tokenized output file (default: corpus/nemotron_encoded.jsonl)")
    parser.add_argument("--no-tokenize", action="store_true",
                        help="Append to corpus only; skip tokenization")
    parser.add_argument("--tokenize-only", action="store_true",
                        help="Tokenize the full existing corpus; skip ingestion")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate and report without writing any files")
    args = parser.parse_args()

    corpus_path = Path(args.corpus)
    encoded_path = Path(args.encoded_out)

    # ── Tokenize-only mode ────────────────────────────────────────────────────
    if args.tokenize_only:
        records = []
        if corpus_path.exists():
            with corpus_path.open(encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            records.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass
        print(f"Loaded {len(records)} records from {corpus_path}")
        if records and not args.no_tokenize:
            _write_encoded(tokenize_records(records), encoded_path, args.dry_run)
        return

    # ── Ingestion mode ────────────────────────────────────────────────────────
    if args.input == "-":
        raw_lines = sys.stdin.read().splitlines()
    else:
        raw_lines = Path(args.input).read_text(encoding="utf-8").splitlines()

    # 1. Parse and validate
    parsed = []
    for i, line in enumerate(raw_lines, 1):
        line = line.strip()
        if not line:
            continue
        try:
            raw = json.loads(line)
        except json.JSONDecodeError as e:
            print(f"SKIP line {i}: invalid JSON — {e}")
            continue
        errors = validate_record(raw)
        if errors:
            snippet = line[:60]
            print(f"SKIP line {i}: {'; '.join(errors)}  [{snippet}...]")
            continue
        parsed.append(raw)

    print(f"\nParsed {len(parsed)} valid / {len(raw_lines)} input lines")

    # 2. Deduplicate by scenario_family (not exact match)
    #    Within a family, content sha256 determines uniqueness.
    existing = load_family_signatures(corpus_path)
    new_records = []
    skipped_dup = 0
    for raw in parsed:
        rec = normalise(raw)
        fam = rec["scenario_family"]
        sig = rec["source_sha256"]
        if sig in existing.get(fam, set()):
            skipped_dup += 1
            continue
        existing.setdefault(fam, set()).add(sig)
        new_records.append(rec)

    print(f"New: {len(new_records)}  |  Duplicate (same family + content): {skipped_dup}")

    if new_records:
        fam_counts: dict[str, int] = {}
        for r in new_records:
            fam_counts[r["scenario_family"]] = fam_counts.get(r["scenario_family"], 0) + 1
        print("\nNew records by family:")
        for fam, count in sorted(fam_counts.items(), key=lambda x: -x[1]):
            decision_counts: dict[str, int] = {}
            for r in new_records:
                if r["scenario_family"] == fam:
                    d = r.get("expected", {}).get("decision", "?")
                    decision_counts[d] = decision_counts.get(d, 0) + 1
            breakdown = "  ".join(f"{d}={c}" for d, c in decision_counts.items())
            print(f"  {fam}: {count}  ({breakdown})")

    # 3. Append to corpus
    if new_records and not args.dry_run:
        corpus_path.parent.mkdir(parents=True, exist_ok=True)
        with corpus_path.open("a", encoding="utf-8") as f:
            for rec in new_records:
                f.write(json.dumps(rec) + "\n")
        print(f"\nAppended {len(new_records)} records → {corpus_path}")
    elif args.dry_run:
        print(f"\nDRY RUN — would append {len(new_records)} records to {corpus_path}")

    # 4. Tokenize for Nemotron
    if not args.no_tokenize and new_records:
        encoded = tokenize_records(new_records)
        _write_encoded(encoded, encoded_path, args.dry_run)


def _write_encoded(encoded: list[dict], out_path: Path, dry_run: bool) -> None:
    if not encoded:
        return
    total_tokens = sum(e["seq_len"] for e in encoded)
    avg = total_tokens // len(encoded)
    if not dry_run:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("a", encoding="utf-8") as f:
            for enc in encoded:
                f.write(json.dumps(enc) + "\n")
        print(f"\nTokenized {len(encoded)} sequences → {out_path}")
    else:
        print(f"\nDRY RUN — would write {len(encoded)} tokenized sequences to {out_path}")
    print(f"Total tokens: {total_tokens:,}  |  Avg seq len: {avg}  |  Max: {MAX_SEQ_LEN}")


if __name__ == "__main__":
    main()
