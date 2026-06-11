"""Tic-tac-toe board logic.

A board is a list of 9 ints in reading order: X=1, O=-1, empty=0.
X always moves first.
"""

from typing import List, Optional

X, O, EMPTY = 1, -1, 0

WIN_LINES = (
    (0, 1, 2), (3, 4, 5), (6, 7, 8),   # rows
    (0, 3, 6), (1, 4, 7), (2, 5, 8),   # columns
    (0, 4, 8), (2, 4, 6),              # diagonals
)


def new_board() -> List[int]:
    return [EMPTY] * 9


def legal_moves(board: List[int]) -> List[int]:
    return [i for i, v in enumerate(board) if v == EMPTY]


def apply_move(board: List[int], move: int, player: int) -> List[int]:
    """Pure: returns a new board with `player`'s mark on `move`."""
    assert board[move] == EMPTY
    nxt = list(board)
    nxt[move] = player
    return nxt


def winner(board: List[int]) -> Optional[int]:
    """1 or -1 if that player has won, 0 for a draw, None if ongoing."""
    for a, b, c in WIN_LINES:
        if board[a] != EMPTY and board[a] == board[b] == board[c]:
            return board[a]
    if EMPTY not in board:
        return 0
    return None


def render(board: List[int], show_indices: bool = False) -> str:
    """Pretty 3x3 grid. With show_indices, empty cells show their 1-9 number."""
    marks = {X: "X", O: "O"}
    cells = [
        marks.get(v, str(i + 1) if show_indices else " ")
        for i, v in enumerate(board)
    ]
    rows = [" {} | {} | {} ".format(*cells[r:r + 3]) for r in (0, 3, 6)]
    return "\n-----------\n".join(rows)
