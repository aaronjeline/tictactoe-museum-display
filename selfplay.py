"""Turn observed games into training data.

This module is the only source of training signal in the project: it plays
games and records, for every move, the board as the mover left it together
with how the game eventually ended for that mover. Nothing here knows what
a good move is — it never imports minimax.
"""

import random
from collections import deque
from typing import List, Optional, Tuple

import torch

from agents import NetAgent, RandomAgent
from game import apply_move, legal_moves, new_board, winner
from model import ValueNet, encode

# The 8 symmetries of the board (rotations and reflections) as index
# permutations: transformed[i] = original[perm[i]]. Showing the network a
# position is observation; showing it the same position in a mirror still is.
_ROT90 = (6, 3, 0, 7, 4, 1, 8, 5, 2)
_FLIP = (2, 1, 0, 5, 4, 3, 8, 7, 6)


def _make_symmetries() -> List[Tuple[int, ...]]:
    syms = []
    for base in (tuple(range(9)), _FLIP):
        p = base
        for _ in range(4):
            syms.append(p)
            p = tuple(p[i] for i in _ROT90)
    return syms


SYMMETRIES = _make_symmetries()


def play_game(
    agent_x, agent_o,
    board: Optional[List[int]] = None,
    player: int = 1,
) -> Tuple[List[Tuple[List[int], int]], int]:
    """Play a game out (from the start, or from a given position).
    Returns ([(afterstate, mover), ...], z) where z is the outcome from
    X's perspective: +1 X won, -1 O won, 0 draw."""
    board = new_board() if board is None else list(board)
    agents = {1: agent_x, -1: agent_o}
    records = []
    while True:
        move = agents[player].select_move(board, player)
        board = apply_move(board, move, player)
        records.append((board, player))
        z = winner(board)
        if z is not None:
            return records, z
        player = -player


def all_reachable_positions() -> List[Tuple[Tuple[int, ...], int]]:
    """Every reachable, non-terminal (board, player-to-move) pair, found by
    breadth-first search from the empty board. This uses only the rules of
    the game — no notion of which positions or moves are good."""
    start = (tuple(new_board()), 1)
    seen = {start}
    queue = deque([start])
    positions = []
    while queue:
        board_t, player = queue.popleft()
        board = list(board_t)
        if winner(board) is not None:
            continue
        positions.append((board_t, player))
        for m in legal_moves(board):
            child = (tuple(apply_move(board, m, player)), -player)
            if child not in seen:
                seen.add(child)
                queue.append(child)
    return positions


def generate_dataset(
    net: Optional[ValueNet],
    n_games: int,
    epsilon: float,
    frac_vs_random: float,
    rng: random.Random,
    augment: bool = True,
) -> Tuple[torch.Tensor, torch.Tensor]:
    """Observe n_games and emit (inputs, targets) tensors.

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
    """
    xs, ys = [], []

    def observe(records, z):
        for afterstate, mover in records:
            target = float(z * mover)  # outcome from the mover's perspective
            variants = (
                [[afterstate[p[i]] for i in range(9)] for p in SYMMETRIES]
                if augment else [afterstate]
            )
            for b in variants:
                xs.append(encode(b, mover))
                ys.append(target)

    random_agent = RandomAgent(rng)
    for g in range(n_games):
        if net is None:
            records, z = play_game(random_agent, random_agent)
        else:
            net_agent = NetAgent(net, epsilon=epsilon, rng=rng)
            if rng.random() < frac_vs_random:
                if g % 2 == 0:
                    records, z = play_game(net_agent, random_agent)
                else:
                    records, z = play_game(random_agent, net_agent)
            else:
                records, z = play_game(net_agent, net_agent)
        observe(records, z)

    if net is not None:
        greedy = NetAgent(net)
        for board_t, player in all_reachable_positions():
            board = apply_move(list(board_t), rng.choice(legal_moves(list(board_t))), player)
            records = [(board, player)]
            z = winner(board)
            if z is None:
                more, z = play_game(greedy, greedy, board=board, player=-player)
                records += more
            observe(records, z)

    return torch.stack(xs), torch.tensor(ys, dtype=torch.float32).unsqueeze(1)
