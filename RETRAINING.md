# Retraining the network

Full retrain (overwrites `models/value_net.pt`, ~2 min on CPU, deterministic):

```bash
python3 train.py
```

Then confirm the new model still meets the museum bar (exits non-zero on failure):

```bash
python3 evaluate.py
```

A passing model never loses to perfect play, never loses to a random player,
and makes zero game-losing moves across all 4,520 reachable positions.

## Quick smoke test (~5 s, weak model — just proves the pipeline runs)

```bash
python3 train.py --gens 2 --games-per-gen 200 --epochs 2 --out models/smoke.pt
python3 evaluate.py --model models/smoke.pt --games 50 --skip-exhaustive
```

## Knobs worth knowing (`python3 train.py --help` for all)

| Flag | Default | Effect |
|---|---|---|
| `--seed` | 0 | Different seed = different (still passing) model. Seeds 0/1/2 verified. |
| `--gens` | 16 | Generations of self-play. 12 mostly passes; 16 gives margin. |
| `--games-per-gen` | 2500 | Full games per generation (the every-position sweep adds 4,520 more). |
| `--eps-floor` | 0.10 | Minimum exploration. Raise if the exhaustive check fails. |
| `--frac-vs-random` | 0.2 | Share of games vs a random opponent (keeps blunder-punishment in the data). |
| `--no-augment` | off | Drops the 8-fold symmetry augmentation (purist mode; expect to need more games). |
| `--out` | models/value_net.pt | Write elsewhere to keep the shipped model untouched. |

If `evaluate.py` reports residual game-losing moves, retrain with more `--gens`
(and/or a higher `--eps-floor`) — never by adding search or minimax labels;
the exhibit's premise is that the network learns only from watched games.

## Regenerating the web exhibit data

The exhibit page (`web/`) bundles one checkpoint per generation plus the
untrained network. After any retrain, regenerate them:

```bash
python3 train.py --checkpoint-dir models/checkpoints   # also rewrites value_net.pt
python3 export_web.py            # grades every checkpoint, writes web/src/data/checkpoints.json
cd web && npm test && npm run build
```

`npm test` re-checks that the browser-side inference matches PyTorch on the
freshly exported test vectors. See `web/README.md` for serving the page.

Note for the display document: `DEMO.md` records a training run's exact output.
After deliberately changing the recipe or code, refresh and re-check it with
`showme verify DEMO.md --output DEMO.md && showme verify DEMO.md`.
