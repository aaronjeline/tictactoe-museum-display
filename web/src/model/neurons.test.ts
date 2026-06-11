import { describe, expect, it } from 'vitest'
import data from '../data/checkpoints.json'
import type { CheckpointFile } from './types'
import { influenceRanks, lineCaption, receptiveField } from './neurons'

const file = data as unknown as CheckpointFile
const gen15 = file.checkpoints[file.checkpoints.length - 1]

describe('neurons', () => {
  it('influence ranks are a permutation of 0..63', () => {
    const ranks = influenceRanks(gen15.weights)
    expect([...ranks].sort((a, b) => a - b)).toEqual([...Array(64).keys()])
  })

  it('several top-influence neurons read as line detectors at gen15', () => {
    const ranks = influenceRanks(gen15.weights)
    const topNeurons = ranks
      .map((r, n) => ({ r, n }))
      .filter((x) => x.r < 6)
      .map((x) => x.n)
    const captions = topNeurons.map((n) => lineCaption(receptiveField(gen15.weights, n)))
    expect(captions.filter((c) => c !== null).length).toBeGreaterThanOrEqual(2)
  })

  it('receptive field slices the right row', () => {
    const f = receptiveField(gen15.weights, 7)
    expect(f.mine).toEqual(gen15.weights.W1.slice(7 * 18, 7 * 18 + 9))
    expect(f.theirs).toEqual(gen15.weights.W1.slice(7 * 18 + 9, 8 * 18))
  })
})
