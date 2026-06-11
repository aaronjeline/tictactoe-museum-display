"""Players. Uniform interface: select_move(board, player) -> cell index.

(The perfect MinimaxAgent used for grading lives in minimax.py, so that
nothing imported by the training pipeline ever touches the solver.)
"""

import random
from typing import List, Optional, Tuple

import torch

from game import apply_move, legal_moves
from model import ValueNet, encode


class RandomAgent:
    def __init__(self, rng: Optional[random.Random] = None):
        self.rng = rng or random.Random()

    def select_move(self, board: List[int], player: int) -> int:
        return self.rng.choice(legal_moves(board))


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
