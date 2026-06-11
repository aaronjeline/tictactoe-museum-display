"""Memoized negamax solver for tic-tac-toe.

EVALUATION ONLY. This module is the examiner, never the teacher: nothing in
the training path (selfplay.py, train.py) imports it. It exists so we can
prove, after the fact, that the network learned to play well.
"""

import random
from typing import Dict, List, Optional, Tuple

from game import apply_move, legal_moves, winner

_MEMO: Dict[Tuple[Tuple[int, ...], int], int] = {}


def solve(board: List[int], player: int) -> int:
    """Game-theoretic value of the position for `player` to move:
    +1 win, 0 draw, -1 loss under perfect play by both sides."""
    key = (tuple(board), player)
    if key not in _MEMO:
        w = winner(board)
        if w is not None:
            _MEMO[key] = 0 if w == 0 else (1 if w == player else -1)
        else:
            _MEMO[key] = max(
                -solve(apply_move(board, m, player), -player)
                for m in legal_moves(board)
            )
    return _MEMO[key]


def optimal_moves(board: List[int], player: int) -> List[int]:
    """All moves that preserve the position's game-theoretic value."""
    best = solve(board, player)
    return [
        m for m in legal_moves(board)
        if -solve(apply_move(board, m, player), -player) == best
    ]


class MinimaxAgent:
    """Perfect player. Picks uniformly among all optimal moves so that it
    probes the network broadly instead of replaying one canonical line."""

    def __init__(self, rng: Optional[random.Random] = None):
        self.rng = rng or random.Random()

    def select_move(self, board: List[int], player: int) -> int:
        return self.rng.choice(optimal_moves(board, player))
