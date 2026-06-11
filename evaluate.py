"""Prove the trained network is a good player.

Minimax appears here and only here — as the examiner, never the teacher.
Three checks, each with an explicit PASS/FAIL:

  1. vs perfect play (minimax with randomized optimal tie-breaks):
     the network must never lose. Wins are impossible; expect all draws.
  2. vs a random player: the network must never lose and must win the
     large majority (perfect play wins ~97% as X, ~80-90% as O).
  3. Exhaustive blunder check: from EVERY reachable position, the network's
     chosen move must never turn a winning or drawable position into a
     theoretical loss. Missed wins (settling for a draw when a forced win
     existed) are reported separately.

Exits non-zero if any check fails.
"""

import argparse
import random
import sys
from collections import deque
from typing import Tuple

import minimax
from agents import NetAgent, RandomAgent
from game import apply_move, legal_moves, new_board, winner
from minimax import MinimaxAgent
from model import load
from selfplay import play_game


def play_match(net_agent, opponent, n_per_side):
    """net_agent plays n games as X and n as O. Returns {side: (w, d, l)}."""
    results = {}
    for side, label in ((1, "as X"), (-1, "as O")):
        w = d = l = 0
        for _ in range(n_per_side):
            if side == 1:
                _, z = play_game(net_agent, opponent)
                mine = z
            else:
                _, z = play_game(opponent, net_agent)
                mine = -z
            if mine > 0:
                w += 1
            elif mine < 0:
                l += 1
            else:
                d += 1
        results[label] = (w, d, l)
    return results


def blunder_check(net) -> Tuple[int, int, int]:
    """Walk every reachable non-terminal position (BFS from the empty board)
    and grade the network's greedy move against the position's game-theoretic
    value. Returns (losing_blunders, missed_wins, positions_checked)."""
    agent = NetAgent(net)
    start = (tuple(new_board()), 1)
    seen = {start}
    queue = deque([start])
    losing_blunders = missed_wins = checked = 0
    while queue:
        board_t, player = queue.popleft()
        board = list(board_t)
        if winner(board) is not None:
            continue
        checked += 1
        best = minimax.solve(board, player)
        move = agent.select_move(board, player)
        achieved = -minimax.solve(apply_move(board, move, player), -player)
        if achieved == -1 and best > -1:
            losing_blunders += 1
        elif best == 1 and achieved == 0:
            missed_wins += 1
        for m in legal_moves(board):
            child = (tuple(apply_move(board, m, player)), -player)
            if child not in seen:
                seen.add(child)
                queue.append(child)
    return losing_blunders, missed_wins, checked


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--model", default="models/value_net.pt")
    ap.add_argument("--games-minimax", type=int, default=200, help="per side")
    ap.add_argument("--games-random", type=int, default=500, help="per side")
    ap.add_argument("--games", type=int, default=None,
                    help="override both per-side game counts")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--skip-exhaustive", action="store_true")
    args = ap.parse_args()
    if args.games is not None:
        args.games_minimax = args.games_random = args.games

    net = load(args.model)
    net_agent = NetAgent(net)
    failures = []

    n = args.games_minimax
    res = play_match(net_agent, MinimaxAgent(rng=random.Random(args.seed)), n)
    print("vs perfect play (%d games per side):" % n)
    losses = 0
    for label, (w, d, l) in res.items():
        print("  %s: %3d wins  %3d draws  %3d losses" % (label, w, d, l))
        losses += l
    ok = losses == 0
    print("  %s  (must never lose)" % ("PASS" if ok else "FAIL"))
    if not ok:
        failures.append("lost %d games to perfect play" % losses)

    n = args.games_random
    res = play_match(net_agent, RandomAgent(rng=random.Random(args.seed + 1)), n)
    print("vs random player (%d games per side):" % n)
    thresholds = {"as X": 0.90, "as O": 0.75}
    ok = True
    for label, (w, d, l) in res.items():
        rate = w / float(n)
        print("  %s: %3d wins  %3d draws  %3d losses  (win rate %.1f%%)"
              % (label, w, d, l, 100 * rate))
        if l > 0 or rate < thresholds[label]:
            ok = False
    print("  %s  (must never lose; win >=90%% as X, >=75%% as O)"
          % ("PASS" if ok else "FAIL"))
    if not ok:
        failures.append("underperformed against the random player")

    if not args.skip_exhaustive:
        blunders, missed, checked = blunder_check(net)
        print("exhaustive check of all %d reachable positions:" % checked)
        print("  game-losing moves: %d   missed forced wins: %d" % (blunders, missed))
        ok = blunders == 0
        print("  %s  (must never throw away a win or a draw)"
              % ("PASS" if ok else "FAIL"))
        if not ok:
            failures.append("%d game-losing moves exist" % blunders)

    if failures:
        print("RESULT: FAIL —", "; ".join(failures))
        sys.exit(1)
    print("RESULT: PASS — the network is a sound player.")


if __name__ == "__main__":
    main()
