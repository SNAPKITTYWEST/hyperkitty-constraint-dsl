# Lean LLM Starter Production Hardening

## Kernel integrity

- Pin `mathlib4` and Lean toolchain versions in both docs and CI.
- Keep the Lean verifier container read-only and networkless.
- Store inference outputs and verification outputs separately.

## Proposal containment

- Treat every model response as untrusted until schema and Lean checks pass.
- Cap retry count for repair loops.
- Log prompt hash, response hash, Lean result, and artifact path for every run.

## Operational work

1. Add CI that runs parse smoke tests and Lean build together.
2. Add a release checklist for Hugging Face publication.
3. Add a signed audit artifact format for successful verification runs.
