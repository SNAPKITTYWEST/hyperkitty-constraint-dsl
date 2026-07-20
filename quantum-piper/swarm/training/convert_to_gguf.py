"""
Sovereign GGUF conversion pipeline.

Steps:
  1. Merge LoRA adapter into base model → full safetensors
  2. Convert merged model to GGUF via llama.cpp convert script
  3. Quantize to Q4_K_M (default) or Q8_0

Usage:
  python -m training.convert_to_gguf
  python -m training.convert_to_gguf --quant Q8_0
  python -m training.convert_to_gguf --base-model meta-llama/Llama-3.3-70B-Instruct

Outputs:
  ./adapters/snapkitty-merged/    — merged safetensors
  ./adapters/snapkitty.gguf       — GGUF (pre-quant)
  ./adapters/snapkitty-Q4_K_M.gguf — quantized, ready for llama-cpp-python
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

ADAPTER_PATH  = Path(__file__).parent.parent / "adapters" / "snapkitty-lora"
MERGED_PATH   = Path(__file__).parent.parent / "adapters" / "snapkitty-merged"
GGUF_PATH     = Path(__file__).parent.parent / "adapters" / "snapkitty.gguf"

LLAMA_CPP_DIR         = Path(os.environ.get("LLAMA_CPP_DIR",         r"C:\tools\llama.cpp"))
LLAMA_CPP_SCRIPTS_DIR = Path(os.environ.get("LLAMA_CPP_SCRIPTS_DIR", r"C:\tools\llama.cpp-scripts"))

BASE_MODEL = os.environ.get("SNAPKITTY_BASE_MODEL", "meta-llama/Llama-3.3-70B-Instruct")


def merge_adapter(base_model: str) -> Path:
    if not ADAPTER_PATH.exists():
        raise FileNotFoundError(f"No adapter at {ADAPTER_PATH} — run training/finetune.py first")

    print(f"[Convert] Loading base model: {base_model}")
    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)

    base = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.bfloat16,
        device_map="cpu",
        trust_remote_code=True,
    )

    print(f"[Convert] Merging LoRA adapter from {ADAPTER_PATH}")
    model = PeftModel.from_pretrained(base, str(ADAPTER_PATH))
    model = model.merge_and_unload()

    MERGED_PATH.mkdir(parents=True, exist_ok=True)
    print(f"[Convert] Saving merged model to {MERGED_PATH}")
    model.save_pretrained(str(MERGED_PATH), safe_serialization=True)
    tokenizer.save_pretrained(str(MERGED_PATH))
    print("[Convert] Merge complete.")
    return MERGED_PATH


def convert_to_gguf(merged_path: Path) -> Path:
    convert_script = LLAMA_CPP_SCRIPTS_DIR / "convert_hf_to_gguf.py"
    if not convert_script.exists():
        raise FileNotFoundError(
            f"convert_hf_to_gguf.py not found at {convert_script}\n"
            f"Set LLAMA_CPP_SCRIPTS_DIR env var or clone llama.cpp to C:\\tools\\llama.cpp-scripts"
        )

    print(f"[Convert] Converting to GGUF: {GGUF_PATH}")
    result = subprocess.run(
        [sys.executable, str(convert_script), str(merged_path),
         "--outfile", str(GGUF_PATH), "--outtype", "f16"],
        check=True,
        capture_output=False,
    )
    print("[Convert] GGUF conversion complete.")
    return GGUF_PATH


def quantize(gguf_path: Path, quant_type: str = "Q4_K_M") -> Path:
    quantize_bin = LLAMA_CPP_DIR / "llama-quantize.exe"
    if not quantize_bin.exists():
        quantize_bin = LLAMA_CPP_DIR / "llama-quantize"
    if not quantize_bin.exists():
        raise FileNotFoundError(
            f"llama-quantize not found — build llama.cpp first:\n"
            f"  cd {LLAMA_CPP_DIR} && cmake -B build -DGGML_CUDA=ON && cmake --build build --config Release"
        )

    out_path = gguf_path.parent / f"snapkitty-{quant_type}.gguf"
    print(f"[Convert] Quantizing → {quant_type}: {out_path}")
    subprocess.run(
        [str(quantize_bin), str(gguf_path), str(out_path), quant_type],
        check=True,
    )
    print(f"[Convert] Quantization complete: {out_path}")
    return out_path


def main():
    parser = argparse.ArgumentParser(description="Sovereign GGUF conversion pipeline")
    parser.add_argument("--base-model", default=BASE_MODEL)
    parser.add_argument("--quant", default="Q4_K_M", choices=["Q4_K_M", "Q5_K_M", "Q8_0", "Q4_0"])
    parser.add_argument("--skip-merge", action="store_true", help="Use existing merged model")
    parser.add_argument("--skip-convert", action="store_true", help="Use existing GGUF, only quantize")
    args = parser.parse_args()

    if not args.skip_merge:
        merge_adapter(args.base_model)

    if not args.skip_convert:
        convert_to_gguf(MERGED_PATH)

    quantized = quantize(GGUF_PATH, args.quant)

    print(f"\n[Convert] Pipeline complete.")
    print(f"  Merged:    {MERGED_PATH}")
    print(f"  GGUF:      {GGUF_PATH}")
    print(f"  Quantized: {quantized}")
    print(f"\n  Set in python-service/.env:")
    print(f"  GGUF_MODEL_PATH={quantized}")


if __name__ == "__main__":
    main()
