// Pins the TypeScript inference port to the PyTorch reference: the export
// script records per-move afterstate values for several positions at three
// checkpoints (untrained, midway, final); we must reproduce them.
import { describe, expect, it } from 'vitest'
import data from '../data/checkpoints.json'
import type { Board, CheckpointFile, Player } from './types'
import { afterstateValues, selectMove } from './net'

const file = data as unknown as CheckpointFile
const byId = new Map(file.checkpoints.map((c) => [c.id, c]))

describe('net vs PyTorch test vectors', () => {
  it('has vectors for three checkpoints', () => {
    expect(new Set(file.testVectors.map((v) => v.checkpointId)).size).toBe(3)
  })

  for (const vec of file.testVectors) {
    it(`${vec.checkpointId} board=[${vec.board.join('')}] mover=${vec.mover}`, () => {
      const ckpt = byId.get(vec.checkpointId)!
      const got = afterstateValues(ckpt.weights, vec.board as Board, vec.mover as Player)
      expect(got).toHaveLength(vec.expected.length)
      for (let i = 0; i < got.length; i++) {
        expect(got[i].move).toBe(vec.expected[i].move)
        expect(got[i].value).toBeCloseTo(vec.expected[i].value, 4)
      }
      // argmax must agree with Python's choice, unless the top two values
      // are a float-precision near-tie (then either pick is legitimate)
      const sorted = [...vec.expected].sort((a, b) => b.value - a.value)
      const gap = sorted[0].value - (sorted[1]?.value ?? -Infinity)
      if (gap > 1e-4) {
        expect(selectMove(ckpt.weights, vec.board as Board, vec.mover as Player)).toBe(vec.chosen)
      }
    })
  }
})
