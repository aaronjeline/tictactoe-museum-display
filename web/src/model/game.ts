// Mirror of game.py: board is number[9] in reading order, X=1, O=-1, 0 empty.
import type { Board, Player } from './types'

export const WIN_LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6], // diagonals
]

export function newBoard(): Board {
  return new Array(9).fill(0)
}

export function legalMoves(board: Board): number[] {
  const moves: number[] = []
  for (let i = 0; i < 9; i++) if (board[i] === 0) moves.push(i)
  return moves
}

export function applyMove(board: Board, move: number, player: Player): Board {
  const next = board.slice()
  next[move] = player
  return next
}

/** 1 or -1 if that player has won, 0 for a draw, null if ongoing. */
export function winner(board: Board): Player | 0 | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) {
      return board[a] as Player
    }
  }
  return board.includes(0) ? null : 0
}

/** The cells of the winning line, for highlighting; null if no win. */
export function winningLine(board: Board): number[] | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) {
      return [a, b, c]
    }
  }
  return null
}
