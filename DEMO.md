# A Neural Network Learns Tic-Tac-Toe by Watching

*2026-06-11T02:53:40Z by Showboat dev*
<!-- showboat-id: 21c4db00-d3b7-4f2d-8a98-13dd86b1fe7b -->

**A museum piece.** At its core is a small neural network (an 18→64→64→1 multilayer perceptron, about 5,500 weights) that plays tic-tac-toe — and that was never told how to. It learned the way a spectator would: by watching games and noticing which positions went on to become wins, which became draws, and which became losses.

Two rules governed its education:

1. **No teacher.** No minimax oracle, no expert games, no hand-written heuristics. The only training signal that exists anywhere in this codebase is *(a position somebody reached, how that game eventually ended)*.
2. **At play time, the network is the whole player.** There is no search: the network looks at the board each legal move would produce, scores all of them in one forward pass, and plays the move it likes best.

Tic-tac-toe is a solved game, and a perfect player (minimax) does appear in this codebase — but only after training is over, as the **examiner** that grades the network. The result, demonstrated below: the network never loses to perfect play from either side, it converts wins against weak play, and across **every one of the 4,520 reachable positions** it never makes a single game-losing move.

## The codebase

Eight small files. The dependency rule that matters: `train.py` → `selfplay.py` → `agents.py`/`model.py` → `game.py` is the entire training world, and nothing in it imports the solver. `minimax.py` is reached only from `evaluate.py`.

```bash
for f in game.py model.py agents.py selfplay.py train.py minimax.py evaluate.py play.py; do
  printf "%-12s %4d lines   %s\n" "$f" "$(wc -l < $f)" "$(head -1 $f | sed s/\"\"\"//)"
done
```

```output
game.py        52 lines   Tic-tac-toe board logic.
model.py       64 lines   The value network and its board encoding.
agents.py      52 lines   Players. Uniform interface: select_move(board, player) -> cell index.
selfplay.py   144 lines   Turn observed games into training data.
train.py      148 lines   Train the value network purely by observing games.
minimax.py     49 lines   Memoized negamax solver for tic-tac-toe.
evaluate.py   146 lines   Prove the trained network is a good player.
play.py        72 lines   Play tic-tac-toe against the trained network in the terminal.
```

## How the network sees the board

The network is an **afterstate value function**: it is shown the board as it stands *right after a player has placed a mark*, and outputs a single number in [-1, +1] — its prediction of how the game will end *for that player* (+1 win, 0 draw, -1 loss).

One trick carries the whole design: before encoding, the board is **canonicalized to the mover's perspective** — the mover's own pieces always fill the first input plane, the opponent's the second. One shared network therefore plays both X and O, and the sign convention can never get confused: the output is always "how does this end for the player who just moved."

```bash
sed -n '/^def encode/,/return torch/p' model.py
```

```output
def encode(board: List[int], mover: int) -> torch.Tensor:
    """Two binary 9-cell planes: the mover's pieces, then the opponent's."""
    mine = [1.0 if v == mover else 0.0 for v in board]
    theirs = [1.0 if v == -mover else 0.0 for v in board]
    return torch.tensor(mine + theirs, dtype=torch.float32)
```

Playing a move is just as plain: form every legal afterstate, encode them all, one batched forward pass, take the argmax. This is `NetAgent` in `agents.py` — no search, no rollouts, no special cases for terminal positions. If the network wants to win, it has to have *learned* that three in a row is good.

```bash
sed -n '/^class NetAgent/,/deterministic tie-break/p' agents.py
```

```output
class NetAgent:
    """Plays with the value network alone: every legal afterstate is scored
    in one batched forward pass and the best is taken. No search, no
    rollouts, no terminal-state special cases — the network is the player.

    epsilon > 0 mixes in random moves (used for exploration during self-play
    data generation, or to make the exhibit beatable).
    """

    def __init__(self, net: ValueNet, epsilon: float = 0.0,
                 rng: Optional[random.Random] = None):
        self.net = net
        self.epsilon = epsilon
        self.rng = rng or random.Random()

    def afterstate_values(self, board: List[int], player: int) -> List[Tuple[int, float]]:
        moves = legal_moves(board)
        batch = torch.stack(
            [encode(apply_move(board, m, player), player) for m in moves]
        )
        with torch.no_grad():
            values = self.net(batch).squeeze(1).tolist()
        return list(zip(moves, values))

    def select_move(self, board: List[int], player: int) -> int:
        if self.epsilon > 0 and self.rng.random() < self.epsilon:
            return self.rng.choice(legal_moves(board))
        scored = self.afterstate_values(board, player)
        return max(scored, key=lambda mv: mv[1])[0]  # deterministic tie-break
```

## Where the games come from

Training runs in generations (`train.py`):

* **Generation 0 — pure spectating.** The network watches a few thousand games between two random players. Each move of each game becomes one training example: *(the board the mover left behind, the result that mover eventually got)*, fitted with plain MSE regression. Targets are observed outcomes and nothing else.
* **Generations 1+ — it plays what it watches.** New games come from three sources, all observed identically: the network against itself with a dash of exploration (epsilon-greedy, decaying to 0.10); a 20% share against a random opponent, so the data never stops containing blunders that need punishing; and an **exploring-starts sweep** — one game dealt from *every* reachable position, opened with a uniformly random move, then played out by the greedy network. The sweep guarantees the network witnesses games unfolding from situations its own sensible play would never visit; without it, a few latent blunders survive in rarely-reached corners of the state space.
* Every observed position is also shown in all **8 board symmetries** (a mirror shows nothing new, but it teaches the network plenty), and the most recent 4 generations of observations form the training set.

From `selfplay.py`:

```bash
sed -n '/net=None means generation 0/,/nothing else\./p' selfplay.py
```

```output
    net=None means generation 0: the network only watches random players.
    Otherwise the data is n_games full games — a frac_vs_random share of
    epsilon-greedy network vs a random opponent (so the data keeps
    containing blunders worth punishing), the rest epsilon-greedy self-play
    — plus one "exploring starts" sweep: a game dealt from every reachable
    position, opened with a uniformly random move and played out by the
    greedy network. The sweep guarantees the network watches a game unfold
    from every situation the rules allow, including ones its own preferred
    play would never reach, and the strong continuation makes the observed
    outcome an informative label.

    All of it is observation: positions and how the game ended, nothing else.
```

A note on the exploring-starts sweep, since it is the one place a skeptic should look twice: the list of starting positions is produced by `all_reachable_positions()`, a breadth-first walk of the game rules from the empty board. It knows which positions *exist*, not which are *good* — every label still comes from watching a game play out. And the proof that no expert signal leaks in anywhere is mechanical — importing the entire training pipeline never loads the solver module:

```bash
python3 - <<PYEOF
import sys
import train  # pulls in selfplay, agents, model, game
loaded = [m for m in ("train", "selfplay", "agents", "model", "game", "minimax")
          if m in sys.modules]
print("modules loaded by the training pipeline:", ", ".join(loaded))
assert "minimax" not in sys.modules, "the teacher leaked into the classroom!"
print("minimax: never imported")
PYEOF
```

```output
modules loaded by the training pipeline: train, selfplay, agents, model, game
minimax: never imported
```

## Training

The full run: 16 generations, deterministic from `--seed 0`, about two minutes on a laptop CPU. Watch the probe column — by generation 2 the network has already stopped losing to a random player; the remaining generations are it scrubbing rare mistakes out of the corners of the state space.

```bash
python3 train.py
```

```output
gen  0: watched 2500 games of random players           -> 153528 samples | loss 0.5716 | probe vs random: 92W  8D  0L
gen  1: watched 7020 games of its own play (eps=0.35)  -> 211136 samples | loss 0.4290 | probe vs random: 94W  6D  0L
gen  2: watched 7020 games of its own play (eps=0.30)  -> 229552 samples | loss 0.3484 | probe vs random: 97W  3D  0L
gen  3: watched 7020 games of its own play (eps=0.25)  -> 231920 samples | loss 0.3054 | probe vs random: 94W  6D  0L
gen  4: watched 7020 games of its own play (eps=0.20)  -> 236272 samples | loss 0.2095 | probe vs random: 97W  3D  0L
gen  5: watched 7020 games of its own play (eps=0.15)  -> 240520 samples | loss 0.1698 | probe vs random: 93W  7D  0L
gen  6: watched 7020 games of its own play (eps=0.10)  -> 243192 samples | loss 0.1455 | probe vs random: 94W  6D  0L
gen  7: watched 7020 games of its own play (eps=0.10)  -> 243976 samples | loss 0.1233 | probe vs random: 93W  7D  0L
gen  8: watched 7020 games of its own play (eps=0.10)  -> 243272 samples | loss 0.1105 | probe vs random: 98W  2D  0L
gen  9: watched 7020 games of its own play (eps=0.10)  -> 243528 samples | loss 0.1009 | probe vs random: 91W  9D  0L
gen 10: watched 7020 games of its own play (eps=0.10)  -> 212736 samples | loss 0.1447 | probe vs random: 95W  5D  0L
gen 11: watched 7020 games of its own play (eps=0.10)  -> 244160 samples | loss 0.1443 | probe vs random: 97W  3D  0L
gen 12: watched 7020 games of its own play (eps=0.10)  -> 245592 samples | loss 0.1424 | probe vs random: 97W  3D  0L
gen 13: watched 7020 games of its own play (eps=0.10)  -> 245080 samples | loss 0.1406 | probe vs random: 97W  3D  0L
gen 14: watched 7020 games of its own play (eps=0.10)  -> 244072 samples | loss 0.0972 | probe vs random: 96W  4D  0L
gen 15: watched 7020 games of its own play (eps=0.10)  -> 244840 samples | loss 0.0979 | probe vs random: 97W  3D  0L
saved models/value_net.pt
```

## The examination

Only now does `minimax.py` enter: a 49-line memoized negamax solver that grades the finished network three ways.

1. **Against perfect play**, 200 games per side. The perfect player randomizes among its optimal moves, so the network must survive every optimal line, not one canonical game. Winning is impossible; the requirement is *never losing*.
2. **Against a random player**, 500 games per side — the opposite failure mode. A merely cautious player would draw these; a good one punishes mistakes (perfect play wins roughly 97% as X and 80-90% as O).
3. **The exhaustive check**, the exhibit's headline: walk all 4,520 reachable positions, ask the network for its move in each, and have the solver grade it. The requirement: not one move, anywhere in the whole game, that turns a win or a draw into a loss.

```bash
python3 evaluate.py
```

```output
vs perfect play (200 games per side):
  as X:   0 wins  200 draws    0 losses
  as O:   0 wins  200 draws    0 losses
  PASS  (must never lose)
vs random player (500 games per side):
  as X: 490 wins   10 draws    0 losses  (win rate 98.0%)
  as O: 460 wins   40 draws    0 losses  (win rate 92.0%)
  PASS  (must never lose; win >=90% as X, >=75% as O)
exhaustive check of all 4520 reachable positions:
  game-losing moves: 0   missed forced wins: 0
  PASS  (must never throw away a win or a draw)
RESULT: PASS — the network is a sound player.
```

## Watch it think

`play.py` is the exhibit floor: a human against the network, with the network's evaluation of every candidate move printed before it plays (+1 means "I will win from here", -1 means "I will lose"). Below, a scripted human plays X (cells are numbered 1-9): center, then 4, then 8. Two moments worth narrating to a visitor: game theory says that after a center opening, a corner reply draws and an edge reply loses — and on move one the network rates exactly the four edges near -0.9 and the four corners near -0.2, knowledge it was never told, only shown. And on its final move, offered the choice between blocking the human's threat (cell 2, +0.99) and completing its own column (cell 9, +1.00), it declines the block and takes the win.

```bash
printf "X\n5\n4\n8\nn\n" | python3 play.py
```

```output
Play as X or O? [X] 
 1 | 2 | 3 
-----------
 4 | 5 | 6 
-----------
 7 | 8 | 9 
Your move (1-9, q to quit): 
network's view: 1:-0.19  2:-0.88  3:-0.17  4:-0.92  6:-0.92  7:-0.20  8:-0.88  9:-0.21
network plays 3

 1 | 2 | O 
-----------
 4 | X | 6 
-----------
 7 | 8 | 9 
Your move (1-9, q to quit): 
network's view: 1:-0.91  2:-0.97  6:+0.06  7:-1.00  8:-1.00  9:-0.94
network plays 6

 1 | 2 | O 
-----------
 X | X | O 
-----------
 7 | 8 | 9 
Your move (1-9, q to quit): 
network's view: 1:-1.00  2:+0.99  7:-0.99  9:+1.00
network plays 9

   |   | O 
-----------
 X | X | O 
-----------
   | X | O 
The network wins.

Rematch? [y/N] Thanks for playing.
```

## Running the exhibit

\```
python3 play.py                  # play against the network (it will not lose)
python3 play.py --epsilon 0.2    # the merciful mode: 20% random moves, beatable
python3 train.py                 # retrain from scratch, ~2 min, deterministic
python3 evaluate.py              # re-grade the network, exits non-zero on failure
\```

Everything in this document is executable: `showme verify DEMO.md` re-runs every block above — including the full training — and confirms the outputs, the trained model, and every claim in the PASS table reproduce exactly.
