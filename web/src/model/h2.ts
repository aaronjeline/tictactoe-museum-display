// Introspection of second-layer neurons. Their incoming weights are not
// board-shaped, so instead we characterize them by behavior: the network
// only ever sees 5,477 possible afterstates, so every neuron can be
// evaluated on its entire world. From that we get each neuron's
// strongest-firing boards, how often it fires, and whether its activity
// tracks a game concept ("the mover just completed a line", "the opponent
// has a winning reply"). And because the verdict is one linear readout,
// every judgment decomposes exactly into 64 signed votes: pre-tanh output
// = b3 + sum of W3[n] * h2[n].
import { applyMove, legalMoves, newBoard, winner } from './game'
import { encode, forward } from './net'
import type { Board, Player, Weights } from './types'

export interface Afterstate {
  board: Board
  mover: Player
}

let DOMAIN: Afterstate[] | null = null

/** Every reachable non-empty board, from the perspective of the player who
 * just moved — the network's entire input world (terminals included). */
export function afterstates(): Afterstate[] {
  if (DOMAIN) return DOMAIN
  const seen = new Set<string>(['0,0,0,0,0,0,0,0,0|1'])
  const queue: { board: Board; player: Player }[] = [{ board: newBoard(), player: 1 }]
  const out: Afterstate[] = []
  for (let head = 0; head < queue.length; head++) {
    const { board, player } = queue[head]
    if (board.some((v) => v !== 0)) out.push({ board, mover: -player as Player })
    if (winner(board) !== null) continue
    for (const m of legalMoves(board)) {
      const child = applyMove(board, m, player)
      const key = `${child.join(',')}|${-player}`
      if (!seen.has(key)) {
        seen.add(key)
        queue.push({ board: child, player: -player as Player })
      }
    }
  }
  DOMAIN = out
  return out
}

function hasWinningMove(board: Board, player: Player): boolean {
  return legalMoves(board).some((m) => winner(applyMove(board, m, player)) === player)
}

export interface H2Info {
  /** Output weight W3[n]: positive pushes the verdict toward "win". */
  vote: number
  /** Fraction of all afterstates on which this neuron fires (> 0.01). */
  activeFrac: number
  /** Auto-label when activity tracks a concept; null = mixed/unclear. */
  label: 'win detector' | 'threat alarm' | null
  correlation: number
  topBoards: { board: Board; mover: Player; act: number }[]
}

function pearson(a: number[], b: number[]): number {
  const n = a.length
  let sa = 0
  let sb = 0
  for (let i = 0; i < n; i++) {
    sa += a[i]
    sb += b[i]
  }
  const ma = sa / n
  const mb = sb / n
  let cov = 0
  let va = 0
  let vb = 0
  for (let i = 0; i < n; i++) {
    cov += (a[i] - ma) * (b[i] - mb)
    va += (a[i] - ma) ** 2
    vb += (b[i] - mb) ** 2
  }
  const d = Math.sqrt(va * vb)
  return d < 1e-12 ? 0 : cov / d
}

const LABEL_THRESHOLD = 0.25
const TOP_K = 4

const cache = new WeakMap<Weights, H2Info[]>()

export function analyzeH2(w: Weights): H2Info[] {
  const hit = cache.get(w)
  if (hit) return hit

  const domain = afterstates()
  const acts: number[][] = []
  const wonNow: number[] = []
  const oppCanWin: number[] = []
  for (const { board, mover } of domain) {
    acts.push(forward(w, encode(board, mover)).h2)
    const result = winner(board)
    wonNow.push(result === mover ? 1 : 0)
    oppCanWin.push(result === null && hasWinningMove(board, -mover as Player) ? 1 : 0)
  }

  const infos: H2Info[] = []
  for (let n = 0; n < 64; n++) {
    const col = acts.map((row) => row[n])
    const activeFrac = col.filter((v) => v > 0.01).length / col.length
    const cWon = pearson(col, wonNow)
    const cOpp = pearson(col, oppCanWin)
    let label: H2Info['label'] = null
    let correlation = 0
    if (Math.max(cWon, cOpp) > LABEL_THRESHOLD) {
      label = cWon >= cOpp ? 'win detector' : 'threat alarm'
      correlation = Math.max(cWon, cOpp)
    }
    const order = col
      .map((act, i) => ({ act, i }))
      .sort((a, b) => b.act - a.act)
      .slice(0, TOP_K)
    infos.push({
      vote: w.W3[n],
      activeFrac,
      label,
      correlation,
      topBoards: order.map(({ act, i }) => ({ ...domain[i], act })),
    })
  }
  cache.set(w, infos)
  return infos
}

export interface Vote {
  neuron: number
  vote: number
}

/** The verdict's exact decomposition: tanh(b3 + sum of votes). Returns the
 * k votes largest in magnitude for a given forward pass's h2 activations. */
export function topVotes(w: Weights, h2: number[], k = 3): Vote[] {
  return h2
    .map((a, neuron) => ({ neuron, vote: a * w.W3[neuron] }))
    .sort((a, b) => Math.abs(b.vote) - Math.abs(a.vote))
    .slice(0, k)
}
