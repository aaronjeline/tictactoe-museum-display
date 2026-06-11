// Introspection of first-layer neurons. Each h1 neuron's incoming weights
// are board-shaped — two 3x3 planes, exactly like the input encoding — so
// they can be drawn and, often, named: training carves many of them into
// detectors for one of the eight winning lines.
import { WIN_LINES } from './game'
import type { Weights } from './types'

export interface ReceptiveField {
  mine: number[] // 9 weights from the "its pieces" plane
  theirs: number[] // 9 weights from the "opponent's pieces" plane
}

export function receptiveField(w: Weights, n: number): ReceptiveField {
  const row = w.W1.slice(n * 18, n * 18 + 18)
  return { mine: row.slice(0, 9), theirs: row.slice(9, 18) }
}

/** Linear path strength of h1 neuron n to the output: sum_j |W2[j][n]|*|W3[j]|. */
export function influenceStrength(w: Weights, n: number): number {
  let s = 0
  for (let j = 0; j < 64; j++) s += Math.abs(w.W2[j * 64 + n]) * Math.abs(w.W3[j])
  return s
}

/** Influence ranks for all 64 h1 neurons: rank[n] = 0 for the strongest. */
export function influenceRanks(w: Weights): number[] {
  const order = Array.from({ length: 64 }, (_, n) => n).sort(
    (a, b) => influenceStrength(w, b) - influenceStrength(w, a),
  )
  const rank = new Array<number>(64)
  order.forEach((n, i) => (rank[n] = i))
  return rank
}

const LINE_NAMES = [
  'top row', 'middle row', 'bottom row',
  'left column', 'middle column', 'right column',
  'one diagonal', 'the other diagonal',
]

/** If the neuron's weights concentrate on one winning line, name it. */
export function lineCaption(field: ReceptiveField): string | null {
  const mag = (cells: readonly number[], plane: number[]) =>
    cells.reduce((s, c) => s + Math.abs(plane[c]), 0) / cells.length
  const all = [...Array(9).keys()]
  const scores = WIN_LINES.map((line) => {
    const off = all.filter((c) => !line.includes(c))
    return (
      mag(line, field.mine) + mag(line, field.theirs) - (mag(off, field.mine) + mag(off, field.theirs))
    )
  })
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a])
  const best = order[0]
  if (scores[best] <= 0 || scores[best] < 1.6 * Math.max(scores[order[1]], 0.05)) return null

  const line = WIN_LINES[best]
  const mineSum = line.reduce((s, c) => s + field.mine[c], 0)
  const theirsSum = line.reduce((s, c) => s + field.theirs[c], 0)
  const name = LINE_NAMES[best]
  if (mineSum > 0 && theirsSum < 0) return `watches the ${name} — fires when it holds it, silenced by the opponent`
  if (mineSum < 0 && theirsSum > 0) return `watches the ${name} — an alarm: fires as the opponent claims it`
  return `watches the ${name}`
}
