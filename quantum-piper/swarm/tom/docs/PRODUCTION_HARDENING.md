# Twin-O-Matic Production Hardening

## Control points

- Pin separate outer and inner models.
- Cap generation count and lesson register size.
- Validate every outer-loop rewrite against schema before promotion.

## Safety

- Do not let the outer loop rewrite verification or audit code paths.
- Keep `worm/chain.jsonl` append-only and hash-sealed.
- Add a review flag for high-risk outer-loop changes.

## Suggested next work

1. Add deterministic fixtures for PASS / A / B / C / D failure classes.
2. Add a dry-run mode that emits proposed rewrites without applying them.
3. Add generation diff summaries for prompt and hyperparameter changes.
