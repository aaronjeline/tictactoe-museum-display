"""Train the value network purely by observing games.

Generation 0: the network watches random players and learns which positions
led to wins, losses, and draws. Every later generation: the network (with
some exploration) plays the games itself, watches how they end, and learns
from that. No teacher, no minimax, no expert labels anywhere in this file
or anything it imports — only games and their outcomes.
"""

import argparse
import os
import random
from collections import deque

import numpy as np
import torch

from agents import NetAgent, RandomAgent
from model import ValueNet, save
from selfplay import all_reachable_positions, generate_dataset, play_game


def train_generation(net, optimizer, X, y, epochs, batch_size) -> float:
    """A few epochs of MSE regression: predicted outcome vs observed outcome.
    Returns the final epoch's mean loss."""
    loss_fn = torch.nn.MSELoss()
    n = X.shape[0]
    net.train()
    mean_loss = 0.0
    for _ in range(epochs):
        perm = torch.randperm(n)
        total, batches = 0.0, 0
        for i in range(0, n, batch_size):
            idx = perm[i:i + batch_size]
            optimizer.zero_grad()
            loss = loss_fn(net(X[idx]), y[idx])
            loss.backward()
            optimizer.step()
            total += loss.item()
            batches += 1
        mean_loss = total / batches
    net.eval()
    return mean_loss


def probe_vs_random(net, n_games: int, rng: random.Random):
    """Quick strength reading: greedy net vs random, alternating sides."""
    net_agent = NetAgent(net)
    random_agent = RandomAgent(rng)
    w = d = l = 0
    for g in range(n_games):
        if g % 2 == 0:
            _, z = play_game(net_agent, random_agent)
            mine = z
        else:
            _, z = play_game(random_agent, net_agent)
            mine = -z
        if mine > 0:
            w += 1
        elif mine < 0:
            l += 1
        else:
            d += 1
    return w, d, l


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--gens", type=int, default=16)
    ap.add_argument("--games-per-gen", type=int, default=2500,
                    help="full games per generation, in addition to the "
                         "exploring-starts sweep (one game from every "
                         "reachable position)")
    ap.add_argument("--epochs", type=int, default=5, help="epochs per generation")
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--batch-size", type=int, default=256)
    ap.add_argument("--frac-vs-random", type=float, default=0.2,
                    help="share of games played against a random opponent")
    ap.add_argument("--eps-floor", type=float, default=0.10,
                    help="minimum exploration rate in self-play")
    ap.add_argument("--buffer-gens", type=int, default=4,
                    help="train on data from this many recent generations")
    ap.add_argument("--hidden", type=int, default=64)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--no-augment", action="store_true",
                    help="disable the 8-fold board-symmetry augmentation")
    ap.add_argument("--out", default="models/value_net.pt")
    ap.add_argument("--checkpoint-dir", default=None,
                    help="also save a checkpoint per generation (plus the "
                         "untrained init) into this directory")
    args = ap.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    rng = random.Random(args.seed)

    net = ValueNet(hidden=args.hidden)
    optimizer = torch.optim.Adam(net.parameters(), lr=args.lr)
    buffer = deque(maxlen=args.buffer_gens)
    n_sweep = len(all_reachable_positions())
    games_watched = 0
    if args.checkpoint_dir:
        os.makedirs(args.checkpoint_dir, exist_ok=True)
        save(net, os.path.join(args.checkpoint_dir, "init.pt"),
             meta={"gen": -1, "games_watched": 0, "loss": None,
                   "probe": None, "epsilon": None, "seed": args.seed})

    for gen in range(args.gens):
        observed = None if gen == 0 else net
        epsilon = max(args.eps_floor, 0.40 - 0.05 * gen)
        X, y = generate_dataset(
            observed, args.games_per_gen, epsilon, args.frac_vs_random,
            rng, augment=not args.no_augment,
        )
        buffer.append((X, y))
        bx = torch.cat([b[0] for b in buffer])
        by = torch.cat([b[1] for b in buffer])
        loss = train_generation(net, optimizer, bx, by, args.epochs, args.batch_size)
        w, d, l = probe_vs_random(net, 100, rng)
        if gen == 0:
            games, source = args.games_per_gen, "random players"
        else:
            games = args.games_per_gen + n_sweep
            source = "its own play (eps=%.2f)" % epsilon
        print("gen %2d: watched %d games of %-24s -> %6d samples | loss %.4f"
              " | probe vs random: %2dW %2dD %2dL"
              % (gen, games, source, X.shape[0], loss, w, d, l))
        games_watched += games
        if args.checkpoint_dir:
            save(net, os.path.join(args.checkpoint_dir, "gen%02d.pt" % gen),
                 meta={"gen": gen, "games_watched": games_watched,
                       "loss": loss, "probe": [w, d, l],
                       "epsilon": None if gen == 0 else epsilon,
                       "seed": args.seed})

    out_dir = os.path.dirname(args.out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    save(net, args.out, meta={
        "seed": args.seed, "gens": args.gens,
        "games_per_gen": args.games_per_gen, "augment": not args.no_augment,
    })
    print("saved", args.out)


if __name__ == "__main__":
    main()
