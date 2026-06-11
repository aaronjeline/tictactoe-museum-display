# The exhibit web page

A self-contained museum display for the tic-tac-toe value network: visitors
play against the network while watching the board flow through its 5,460
weights, and a training-timeline scrubber lets them face the network at any
point in its education — from 1,522 game-losing mistakes (untrained) down
to zero (generation 15). Inference runs entirely in the browser (the
17 checkpoints are bundled into the page); no backend, no external requests.

## Looking deeper

Four progressive layers let a visitor dig into what the network has learned:

1. **"Why that move?"** — after the network plays, a button on the caption
   strip overlays the board with each mark's contribution to the verdict
   (occlusion: re-evaluate with the mark removed, show the swing). On a
   blocked threat, the verdict visibly rests on the threat marks.
2. **Tap a first-layer neuron** in the network view — a card shows its
   incoming weights as two 3×3 heatmaps (the same two planes the network
   sees), its rank in pull on the verdict, and an auto-generated caption
   when the weights concentrate on one winning line ("watches the right
   column — an alarm: fires as the opponent claims it").
3. **"See all 64 detectors"** — swaps the network for a gallery of every
   first-layer receptive field, sorted by influence at the final
   checkpoint. Scrub the timeline and watch line detectors crystallize out
   of initialization noise.
4. **Skill timeline** — a chart above the scrubber tracks two value-required
   skills per checkpoint (takes an available win, blocks a lone threat;
   definitions filter out positions where the action wouldn't change the
   outcome). Click it to scrub. The story: watching random games teaches
   winning (54%→100%) before defending (30%→88%); one generation of
   self-play fixes blocking.

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
