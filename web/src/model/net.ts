// TypeScript port of the value network (mirrors model.py / agents.py).
//
// PERSPECTIVE INVARIANT — the single sign convention, same as the Python:
//  * encode(board, mover) canonicalizes the board so the mover's pieces fill
//    the first input plane ("mine") and the opponent's the second.
//  * The network's tanh output is the predicted final outcome FROM THE
//    MOVER'S PERSPECTIVE: +1 the mover goes on to win, 0 draw, -1 loses.
//  * The agent always evaluates the board AFTER its own candidate move,
//    with itself as the mover, and maximizes.
//
// JS computes in float64 against weights trained in float32, so values match
// PyTorch to ~1e-5; tests assert 1e-4.
import { applyMove, legalMoves } from './game'
import type { Activations, Board, Player, Weights } from './types'

export function encode(board: Board, mover: Player): number[] {
  const x = new Array<number>(18)
  for (let i = 0; i < 9; i++) {
    x[i] = board[i] === mover ? 1 : 0
    x[i + 9] = board[i] === -mover ? 1 : 0
  }
  return x
}

function linear(W: number[], b: number[], x: number[], nIn: number, nOut: number): number[] {
  const out = new Array<number>(nOut)
  for (let o = 0; o < nOut; o++) {
    let sum = b[o]
    const row = o * nIn
    for (let i = 0; i < nIn; i++) sum += W[row + i] * x[i]
    out[o] = sum
  }
  return out
}

const relu = (v: number[]) => v.map((a) => (a > 0 ? a : 0))

export function forward(w: Weights, input: number[]): Activations {
  const h1 = relu(linear(w.W1, w.b1, input, 18, 64))
  const h2 = relu(linear(w.W2, w.b2, h1, 64, 64))
  const value = Math.tanh(linear(w.W3, w.b3, h2, 64, 1)[0])
  return { input, h1, h2, value }
}

export interface CandidateEval {
  move: number
  value: number
  acts: Activations
}

/** Evaluate every legal afterstate, in move order (matches Python). */
export function afterstateValues(w: Weights, board: Board, player: Player): CandidateEval[] {
  return legalMoves(board).map((move) => {
    const acts = forward(w, encode(applyMove(board, move, player), player))
    return { move, value: acts.value, acts }
  })
}

/** Greedy move: first maximum, matching Python max()'s tie-break. */
export function selectMove(w: Weights, board: Board, player: Player): number {
  const evals = afterstateValues(w, board, player)
  let best = evals[0]
  for (const e of evals) if (e.value > best.value) best = e
  return best.move
}
