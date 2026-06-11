# The exhibit web page

A self-contained museum display for the tic-tac-toe value network: visitors
play against the network while watching the board flow through its 5,460
weights, and a training-timeline scrubber lets them face the network at any
point in its education — from 1,522 game-losing mistakes (untrained) down
to zero (generation 15). Inference runs entirely in the browser (the
17 checkpoints are bundled into the page); no backend, no external requests.

## Commands

```bash
npm install        # once
npm run dev        # development server (http://localhost:5173)
npm test           # vitest: TS inference is pinned to PyTorch test vectors
npm run build      # production build -> dist/
node smoke.mjs     # headless-Chrome end-to-end check (needs `npm run dev` running;
                   #   URL=http://localhost:8000 node smoke.mjs to test a built copy)
```

Deploy: serve `dist/` from any static server, e.g.

```bash
python3 -m http.server -d dist 8000
```

(Open it fullscreen at the kiosk; the layout targets 16:9 at 1080p.)

## Regenerating the model data

`src/data/checkpoints.json` is produced from the repo root (see also
RETRAINING.md):

```bash
python3 train.py --checkpoint-dir models/checkpoints   # ~2 min
python3 export_web.py                                  # ~1 min, writes the JSON
npm test                                               # re-pin TS vs PyTorch
```
