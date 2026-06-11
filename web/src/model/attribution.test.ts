// Mirrors the Python occlusion probe: on a board where X threatens the top
// row and O has ignored it, the verdict (for O) must rest on the two threat
// marks, not on O's own unrelated pieces.
import { describe, expect, it } from 'vitest'
import data from '../data/checkpoints.json'
import type { Board, CheckpointFile } from './types'
import { attribution } from './attribution'

const file = data as unknown as CheckpointFile
const gen15 = file.checkpoints[file.checkpoints.length - 1]

describe('attribution', () => {
  it('localizes a must-block verdict on the threat marks', () => {
    // X at 0,1 (threat at 2), O at 4 and 8; O is the mover
    const board: Board = [1, 1, 0, 0, -1, 0, 0, 0, -1]
    const att = new Map(attribution(gen15.weights, board, -1).map((a) => [a.cell, a.contribution]))
    expect(att.size).toBe(4)
    // the X threat marks drag O's verdict down hard
    expect(att.get(0)!).toBeLessThan(-0.5)
    expect(att.get(1)!).toBeLessThan(-0.5)
    // O's center mark is nearly irrelevant to this verdict
    expect(Math.abs(att.get(4)!)).toBeLessThan(0.1)
  })
})
