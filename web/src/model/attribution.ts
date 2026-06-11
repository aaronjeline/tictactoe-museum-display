// Occlusion attribution: how much each mark on the board contributes to the
// network's verdict. For every occupied cell, re-evaluate the board with
// that one mark removed; the swing in the output is that mark's weight in
// the judgment. (No gradients, no approximation — these are real value
// differences from the same forward pass the player uses.)
import { encode, forward } from './net'
import type { Board, Player, Weights } from './types'

export interface Attribution {
  cell: number
  /** Contribution of the mark to the verdict: positive = this mark raises
   * the predicted outcome for `mover`, negative = it lowers it. */
  contribution: number
}

export function attribution(w: Weights, board: Board, mover: Player): Attribution[] {
  const base = forward(w, encode(board, mover)).value
  const out: Attribution[] = []
  for (let cell = 0; cell < 9; cell++) {
    if (board[cell] === 0) continue
    const occluded = board.slice()
    occluded[cell] = 0
    const without = forward(w, encode(occluded, mover)).value
    out.push({ cell, contribution: base - without })
  }
  return out
}
