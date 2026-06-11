"""The value network and its board encoding.

PERSPECTIVE INVARIANT — the single sign convention in this codebase:

  * encode(board, mover) canonicalizes the board so the mover's pieces fill
    the first input plane ("mine") and the opponent's the second. One shared
    network therefore serves both X and O.
  * The network's tanh output is the predicted final outcome of the game
    FROM THE MOVER'S PERSPECTIVE: +1 the mover goes on to win, 0 draw,
    -1 the mover goes on to lose.
  * Training targets are accordingly z * mover, where z is the game outcome
    from X's perspective (see selfplay.py).

The network is an "afterstate" value function: it is shown the board as it
stands right after a player has placed a mark, and predicts how the game
will end for that player.
"""

from typing import Any, Dict, List, Optional

import torch
import torch.nn as nn


class ValueNet(nn.Module):
    """18 -> hidden -> hidden -> 1 MLP, tanh output in [-1, 1].

    With hidden=64 this is ~5.5k parameters — ample, since tic-tac-toe has
    only ~5.5k legal positions, yet it trains in minutes on a CPU.
    """

    def __init__(self, hidden: int = 64):
        super().__init__()
        self.hidden = hidden
        self.layers = nn.Sequential(
            nn.Linear(18, hidden), nn.ReLU(),
            nn.Linear(hidden, hidden), nn.ReLU(),
            nn.Linear(hidden, 1), nn.Tanh(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.layers(x)


def encode(board: List[int], mover: int) -> torch.Tensor:
    """Two binary 9-cell planes: the mover's pieces, then the opponent's."""
    mine = [1.0 if v == mover else 0.0 for v in board]
    theirs = [1.0 if v == -mover else 0.0 for v in board]
    return torch.tensor(mine + theirs, dtype=torch.float32)


def save(net: ValueNet, path: str, meta: Optional[Dict[str, Any]] = None) -> None:
    torch.save(
        {"state_dict": net.state_dict(), "hidden": net.hidden, "meta": meta or {}},
        path,
    )


def load(path: str) -> ValueNet:
    ckpt = torch.load(path, map_location="cpu")
    net = ValueNet(hidden=ckpt["hidden"])
    net.load_state_dict(ckpt["state_dict"])
    net.eval()
    return net
