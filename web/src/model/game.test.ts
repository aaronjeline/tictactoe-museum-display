import { describe, expect, it } from 'vitest'
import { applyMove, legalMoves, newBoard, winner } from './game'

describe('game', () => {
  it('detects wins on every line', () => {
    expect(winner([1, 1, 1, 0, 0, 0, 0, 0, 0])).toBe(1)
    expect(winner([-1, 0, 0, -1, 0, 0, -1, 0, 0])).toBe(-1)
    expect(winner([1, 0, 0, 0, 1, 0, 0, 0, 1])).toBe(1)
    expect(winner([0, 0, -1, 0, -1, 0, -1, 0, 0])).toBe(-1)
  })

  it('detects draws and ongoing games', () => {
    expect(winner([1, -1, 1, 1, -1, -1, -1, 1, 1])).toBe(0)
    expect(winner(newBoard())).toBeNull()
  })

  it('applyMove is pure and legalMoves shrinks', () => {
    const b = newBoard()
    const b2 = applyMove(b, 4, 1)
    expect(b[4]).toBe(0)
    expect(b2[4]).toBe(1)
    expect(legalMoves(b)).toHaveLength(9)
    expect(legalMoves(b2)).toHaveLength(8)
    expect(legalMoves(b2)).not.toContain(4)
  })
})
