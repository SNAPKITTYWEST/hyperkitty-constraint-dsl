"""
QLoRA fine-tuning for SnapKitty sovereign intelligence.

Usage:
  python -m training.finetune
  python -m training.finetune --model meta-llama/Llama-3.1-8B-Instruct
  python -m training.finetune --model microsoft/phi-2 --epochs 5

Outputs adapter to: ./adapters/snapkitty-lora/
"""

import argparse
import os
from pathlib import Path
import mlflow

import torch
from datasets import Dataset
from peft import LoraConfig, TaskType, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from trl import SFTTrainer

from training.data_prep import build_dataset, format_for_sft

ADAPTER_OUTPUT_DIR = Path(__file__).parent.parent / "adapters" / "snapkitty-lora"
CHECKPOINT_DIR = Path(__file__).parent.parent / "adapters" / "checkpoints"

DEFAULT_MODEL = os.environ.get(
    "SNAPKITTY_BASE_MODEL",
    "meta-llama/Llama-3.1-8B-Instruct",
)

# Local weights root — if set, enforce local_files_only to block HuggingFace fallback
# Set SNAPKITTY_LOCAL_WEIGHTS to the directory containing locally cached model weights
LOCAL_WEIGHTS_ROOT = os.environ.get("SNAPKITTY_LOCAL_WEIGHTS", "")


def _local_files_only(model_id: str) -> bool:
    """
    Violation radar: if a local weights root is configured and the model path
    exists there, enforce local_files_only=True. If the model is not cached
    locally and a remote fetch would occur, halt and flag the violation rather
    than silently pulling from HuggingFace.
    """
    if not LOCAL_WEIGHTS_ROOT:
        return False
    local_path = Path(LOCAL_WEIGHTS_ROOT) / model_id.replace("/", "--")
    if local_path.exists():
        return True
    raise RuntimeError(
        f"[CRITICAL_VIOLATION] SOVEREIGN ISOLATION breach — model '{model_id}' not found "
        f"at {local_path}.\n"
        f"Remediation: download weights to {LOCAL_WEIGHTS_ROOT} or unset SNAPKITTY_LOCAL_WEIGHTS "
        f"to allow remote fetch (dev mode only).\n"
        f"Production sovereign stack must not pull from third-party endpoints at runtime."
    )

LORA_CONFIG = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
)

BNB_CONFIG = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
)


def train(
    base_model: str = DEFAULT_MODEL,
    epochs: int = 3,
    batch_size: int = 4,
    grad_accum: int = 4,
    lr: float = 2e-4,
    max_seq_len: int = 2048,
    resume: bool = False,
):
    print(f"[SnapKitty] Loading base model: {base_model}")

    local_only = _local_files_only(base_model)
    if local_only:
        print(f"[SnapKitty] LOCAL_FILES_ONLY enforced — loading from {LOCAL_WEIGHTS_ROOT}")
    else:
        print(f"[SnapKitty] WARNING: SNAPKITTY_LOCAL_WEIGHTS not set — remote fetch allowed (dev mode)")

    tokenizer = AutoTokenizer.from_pretrained(
        base_model, trust_remote_code=True, local_files_only=local_only,
    )
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=BNB_CONFIG,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.bfloat16,
        local_files_only=local_only,
    )
    model = prepare_model_for_kbit_training(model)
    model = get_peft_model(model, LORA_CONFIG)
    model.print_trainable_parameters()

    print("[SnapKitty] Loading training corpus...")
    dataset = build_dataset()
    split = dataset.train_test_split(test_size=0.05, seed=42)
    train_ds: Dataset = split["train"]
    eval_ds: Dataset = split["test"]
    print(f"[SnapKitty] Train: {len(train_ds)} | Eval: {len(eval_ds)}")

    def formatting_func(batch):
        return [format_for_sft(tokenizer, {"messages": m}) for m in batch["messages"]]

    ADAPTER_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=str(CHECKPOINT_DIR),
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        gradient_accumulation_steps=grad_accum,
        learning_rate=lr,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        bf16=True,
        tf32=True,
        logging_steps=10,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        report_to="none",
        dataloader_num_workers=0,
        optim="paged_adamw_32bit",
        group_by_length=False,
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        formatting_func=formatting_func,
        peft_config=LORA_CONFIG,
        max_seq_length=max_seq_len,
    )

    mlflow.set_tracking_uri(os.environ.get("MLFLOW_TRACKING_URI", "http://localhost:5000"))
    mlflow.set_experiment("snapkitty-finetune")

    with mlflow.start_run(run_name=f"{base_model.split('/')[-1]}-qlora"):
        mlflow.log_params({
            "base_model":  base_model,
            "epochs":      epochs,
            "batch_size":  batch_size,
            "grad_accum":  grad_accum,
            "lr":          lr,
            "max_seq_len": max_seq_len,
            "train_size":  len(train_ds),
            "eval_size":   len(eval_ds),
            "lora_r":      LORA_CONFIG.r,
            "lora_alpha":  LORA_CONFIG.lora_alpha,
        })

        print("[SnapKitty] Starting QLoRA fine-tuning...")
        if resume and CHECKPOINT_DIR.exists():
            trainer.train(resume_from_checkpoint=True)
        else:
            trainer.train()

        print(f"[SnapKitty] Saving LoRA adapter to {ADAPTER_OUTPUT_DIR}")
        trainer.model.save_pretrained(str(ADAPTER_OUTPUT_DIR))
        tokenizer.save_pretrained(str(ADAPTER_OUTPUT_DIR))

        mlflow.log_artifacts(str(ADAPTER_OUTPUT_DIR), artifact_path="adapter")
        mlflow.log_metric("train_samples", len(train_ds))

        print("[SnapKitty] Fine-tuning complete.")
        print(f"[SnapKitty] Adapter saved: {ADAPTER_OUTPUT_DIR}")
        print(f"[SnapKitty] MLflow run logged at {mlflow.get_tracking_uri()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SnapKitty QLoRA fine-tuning")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="HuggingFace model ID")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--grad-accum", type=int, default=4)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--max-seq-len", type=int, default=2048)
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    args = parser.parse_args()

    train(
        base_model=args.model,
        epochs=args.epochs,
        batch_size=args.batch_size,
        grad_accum=args.grad_accum,
        lr=args.lr,
        max_seq_len=args.max_seq_len,
        resume=args.resume,
    )
