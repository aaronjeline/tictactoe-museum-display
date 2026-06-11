"""Export training checkpoints for the web exhibit.

Reads models/checkpoints/{init,gen00..genNN}.pt (produced by
`python3 train.py --checkpoint-dir models/checkpoints`), grades each one
with the evaluation harness, and writes web/src/data/checkpoints.json:
weights as flat row-major arrays, per-checkpoint stats for the timeline
scrubber, and test vectors that pin the TypeScript inference port to the
PyTorch reference.
"""

import argparse
import glob
import json
import os
import random

import torch

import minimax
from agents import NetAgent, RandomAgent
from evaluate import blunder_check, play_match
from game import apply_move, legal_moves, winner
from model import load
from selfplay import all_reachable_positions

STATS_SEED = 99
GAMES_PER_SIDE = 250

# Positions for the TS-vs-PyTorch test vectors: a spread of game phases.
TEST_POSITIONS = [
    ([0, 0, 0, 0, 0, 0, 0, 0, 0], 1),     # empty board, X to open
    ([1, 0, 0, 0, -1, 0, 0, 0, 0], 1),    # early midgame, X
    ([1, 1, 0, 0, -1, 0, 0, 0, 0], -1),   # O must block the top row
    ([1, 1, 0, -1, -1, 0, 0, 0, 0], 1),   # X has a winning move
    ([1, -1, 1, 1, -1, -1, 0, 0, 0], 1),  # late game, X
    ([1, -1, 1, -1, 1, -1, 0, 0, 0], -1), # late game, O
]


def round_sig(x, digits=5):
    return float("%.*g" % (digits, x))


def export_weights(net):
    linears = [net.layers[0], net.layers[2], net.layers[4]]
    out = {}
    for i, lin in enumerate(linears, start=1):
        w = lin.weight.detach().reshape(-1).tolist()  # row-major [out][in]
        b = lin.bias.detach().reshape(-1).tolist()
        out["W%d" % i] = [round_sig(v) for v in w]
        out["b%d" % i] = [round_sig(v) for v in b]
    return out


def _winning_moves(board, player):
    return [m for m in legal_moves(board)
            if winner(apply_move(board, m, player)) == player]


def _skill_position_sets():
    """Two checkpoint-independent probe sets over all reachable positions.

    win_set: the mover has an immediate winning move AND every non-winning
    move forfeits the forced win — so taking the win is value-required.
    block_set: no immediate win, the opponent threatens exactly one winning
    cell, and the position is not already lost — so blocking is the only
    move that avoids defeat. With these filters a zero-mistake player must
    score 100% on both.
    """
    win_set, block_set = [], []
    for board_t, player in all_reachable_positions():
        board = list(board_t)
        wins = _winning_moves(board, player)
        if wins:
            others = [m for m in legal_moves(board) if m not in wins]
            if all(-minimax.solve(apply_move(board, m, player), -player) < 1
                   for m in others):
                win_set.append((board, player, set(wins)))
        else:
            threats = _winning_moves(board, -player)
            if len(threats) == 1 and minimax.solve(board, player) > -1:
                block_set.append((board, player, threats[0]))
    return win_set, block_set


_SKILL_SETS = {}


def skill_stats(net):
    if not _SKILL_SETS:
        _SKILL_SETS["win"], _SKILL_SETS["block"] = _skill_position_sets()
    win_set, block_set = _SKILL_SETS["win"], _SKILL_SETS["block"]
    agent = NetAgent(net)
    takes = sum(agent.select_move(b, p) in ws for b, p, ws in win_set)
    blocks = sum(agent.select_move(b, p) == c for b, p, c in block_set)
    return {
        "takesWin": round(takes / len(win_set), 4),
        "blocksThreat": round(blocks / len(block_set), 4),
        "winPositions": len(win_set),
        "blockPositions": len(block_set),
    }


def checkpoint_stats(net, meta):
    rng = random.Random(STATS_SEED)
    res = play_match(NetAgent(net), RandomAgent(rng=rng), GAMES_PER_SIDE)
    blunders, missed, checked = blunder_check(net)
    return {
        "gamesWatched": meta.get("games_watched", 0),
        "loss": meta.get("loss"),
        "vsRandom": {
            "asX": dict(zip(("w", "d", "l"), res["as X"])),
            "asO": dict(zip(("w", "d", "l"), res["as O"])),
            "gamesPerSide": GAMES_PER_SIDE,
        },
        "losingBlunders": blunders,
        "missedWins": missed,
        "positionsChecked": checked,
        "skills": skill_stats(net),
    }


def test_vectors(checkpoints):
    picks = [checkpoints[0], checkpoints[len(checkpoints) // 2], checkpoints[-1]]
    vectors = []
    for ckpt_id, net in picks:
        agent = NetAgent(net)
        for board, mover in TEST_POSITIONS:
            values = agent.afterstate_values(list(board), mover)
            vectors.append({
                "checkpointId": ckpt_id,
                "board": list(board),
                "mover": mover,
                "expected": [
                    {"move": m, "value": round(v, 6)} for m, v in values
                ],
                # Python's greedy choice (first max). The TS port must agree
                # unless the top two values are a float-precision near-tie.
                "chosen": agent.select_move(list(board), mover),
            })
    return vectors


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--checkpoint-dir", default="models/checkpoints")
    ap.add_argument("--out", default="web/src/data/checkpoints.json")
    args = ap.parse_args()

    paths = sorted(glob.glob(os.path.join(args.checkpoint_dir, "gen*.pt")))
    init = os.path.join(args.checkpoint_dir, "init.pt")
    assert os.path.exists(init) and paths, "run train.py --checkpoint-dir first"
    paths = [init] + paths

    entries = []
    loaded = []
    for path in paths:
        ckpt = torch.load(path, map_location="cpu")
        meta = ckpt.get("meta", {})
        net = load(path)
        gen = meta.get("gen", -1)
        ckpt_id = "init" if gen < 0 else "gen%02d" % gen
        label = "Untrained" if gen < 0 else "Generation %d" % gen
        stats = checkpoint_stats(net, meta)
        entries.append({
            "id": ckpt_id, "gen": gen, "label": label,
            "stats": stats, "weights": export_weights(net),
        })
        loaded.append((ckpt_id, net))
        print("%-6s blunders %4d  missed wins %3d  vs random %3dW/%3dD/%3dL (as X)"
              "  takes win %5.1f%%  blocks %5.1f%%"
              % (ckpt_id, stats["losingBlunders"], stats["missedWins"],
                 *play_x_summary(stats),
                 100 * stats["skills"]["takesWin"],
                 100 * stats["skills"]["blocksThreat"]))

    final_skills = entries[-1]["stats"]["skills"]
    assert final_skills["takesWin"] == 1.0 and final_skills["blocksThreat"] == 1.0, (
        "final checkpoint must be perfect on value-required skills: %r" % final_skills
    )

    doc = {
        "schemaVersion": 2,
        "hidden": loaded[0][1].hidden,
        "checkpoints": entries,
        "testVectors": test_vectors(loaded),
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(doc, f, separators=(",", ":"))
    print("wrote %s (%.1f KB, %d checkpoints, %d test vectors)"
          % (args.out, os.path.getsize(args.out) / 1024.0,
             len(entries), len(doc["testVectors"])))


def play_x_summary(stats):
    x = stats["vsRandom"]["asX"]
    return x["w"], x["d"], x["l"]


if __name__ == "__main__":
    main()
