"""Play tic-tac-toe against the trained network in the terminal.

Cells are numbered 1-9 in reading order. Before the network moves, it shows
its evaluation of every legal move (+1 = it expects to win, -1 = to lose),
so you can watch it think. Pass --epsilon 0.2 to make it fallible.
"""

import argparse
import random

from agents import NetAgent
from game import apply_move, new_board, render, winner
from model import load


def human_move(board):
    while True:
        raw = input("Your move (1-9, q to quit): ").strip().lower()
        if raw in ("q", "quit", "exit"):
            raise SystemExit(0)
        if raw.isdigit() and 1 <= int(raw) <= 9 and board[int(raw) - 1] == 0:
            return int(raw) - 1
        print("That cell isn't open — pick an empty cell, 1-9.")


def play_once(agent, human):
    board = new_board()
    player = 1
    while winner(board) is None:
        if player == human:
            print()
            print(render(board, show_indices=True))
            move = human_move(board)
        else:
            values = agent.afterstate_values(board, player)
            print("\nnetwork's view: "
                  + "  ".join("%d:%+.2f" % (m + 1, v) for m, v in values))
            move = agent.select_move(board, player)
            print("network plays %d" % (move + 1))
        board = apply_move(board, move, player)
        player = -player
    print()
    print(render(board))
    result = winner(board)
    if result == 0:
        print("Draw.")
    elif result == human:
        print("You win!")
    else:
        print("The network wins.")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--model", default="models/value_net.pt")
    ap.add_argument("--epsilon", type=float, default=0.0,
                    help="chance per move that the network plays randomly")
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args()

    agent = NetAgent(load(args.model), epsilon=args.epsilon,
                     rng=random.Random(args.seed))
    while True:
        side = input("Play as X or O? [X] ").strip().upper() or "X"
        play_once(agent, 1 if side != "O" else -1)
        if input("\nRematch? [y/N] ").strip().lower() != "y":
            print("Thanks for playing.")
            break


if __name__ == "__main__":
    main()
