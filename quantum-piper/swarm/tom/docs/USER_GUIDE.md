# Twin-O-Matic User Guide

## What it does

Twin-O-Matic runs a controlled recursive improvement loop:

- the outer loop rewrites the worker
- the inner loop executes the task
- the assert gate blocks unstable outer-loop output
- the WORM chain records each generation

## Start modes

### Full loop

```bash
export TOM_OUTER_MODEL=nemotron
export TOM_INNER_MODEL=nemotron
export OLLAMA_URL=http://localhost:11434
python tom.py --task "write an optimized Python merge sort" --generations 5
```

### Inner-only

```bash
python tom.py --task "prove x^2 >= 0" --generations 3 --inner-only
```

## Read the state

- `state/inner_prompt.txt` or equivalent live state: current worker contract
- `state/lessons.json`: compressed memory carried between generations
- `worm/chain.jsonl`: immutable generation audit trail

## Operator advice

- Use bounded generation counts in normal work.
- Review outer-loop rewrites before promoting them to production tasks.
- Keep schema validation on at all times.
