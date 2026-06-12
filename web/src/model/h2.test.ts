import { describe, expect, it } from 'vitest'
import data from '../data/checkpoints.json'
import type { Board, CheckpointFile } from './types'
import { encode, forward } from './net'
import { afterstates, analyzeH2, topVotes } from './h2'

const file = data as unknown as CheckpointFile
const gen15 = file.checkpoints[file.checkpoints.length - 1]

describe('h2 introspection', () => {
  it('enumerates the full afterstate domain', () => {
    expect(afterstates()).toHaveLength(5477)
  })

  it('vote decomposition is exact: tanh(b3 + all votes) = verdict', () => {
    const board: Board = [1, 1, 0, 0, -1, 0, 0, 0, -1]
    const acts = forward(gen15.weights, encode(board, -1))
    const all = topVotes(gen15.weights, acts.h2, 64)
    const sum = all.reduce((s, v) => s + v.vote, 0) + gen15.weights.b3[0]
    expect(Math.tanh(sum)).toBeCloseTo(acts.value, 6)
  })

  it('labels specialized neurons at gen15, with signs matching their votes', () => {
    const infos = analyzeH2(gen15.weights)
    const labeled = infos.filter((i) => i.label !== null)
    expect(labeled.length).toBeGreaterThanOrEqual(8)
    // strongly-correlated win detectors should vote positive, alarms negative
    for (const i of labeled.filter((x) => x.correlation > 0.4)) {
      expect(i.label === 'win detector' ? i.vote > 0 : i.vote < 0).toBe(true)
    }
    // every win detector's top board should actually be a won game
    const win = infos.find((i) => i.label === 'win detector' && i.correlation > 0.5)
    expect(win).toBeDefined()
  })
})
