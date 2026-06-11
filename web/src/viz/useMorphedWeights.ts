// Shared 600 ms weight morph: give it target weights, read the currently
// shown (lerped) weights each animation frame via the returned ref. Both the
// network view and the detector gallery animate scrubbing through this.
import { useRef } from 'react'
import type { Weights } from '../model/types'

export const MORPH_MS = 600

export interface MorphState {
  target: Weights
  shown: Weights
  morphFrom: Weights | null
  morphStart: number
}

function lerpWeights(a: Weights, b: Weights, t: number): Weights {
  const mix = (u: number[], v: number[]) => u.map((x, i) => x + (v[i] - x) * t)
  return {
    W1: mix(a.W1, b.W1), b1: mix(a.b1, b.b1),
    W2: mix(a.W2, b.W2), b2: mix(a.b2, b.b2),
    W3: mix(a.W3, b.W3), b3: mix(a.b3, b.b3),
  }
}

export function useMorphedWeights(weights: Weights) {
  const morph = useRef<MorphState>({
    target: weights,
    shown: weights,
    morphFrom: null,
    morphStart: 0,
  })
  if (morph.current.target !== weights) {
    morph.current.morphFrom = morph.current.shown
    morph.current.morphStart = performance.now()
    morph.current.target = weights
  }
  return morph
}

/** Advance the morph for this frame; returns true if weights changed. */
export function stepMorph(s: MorphState, now: number): boolean {
  if (s.morphFrom === null) return false
  const t = Math.min(1, (now - s.morphStart) / MORPH_MS)
  const eased = t * (2 - t)
  s.shown = lerpWeights(s.morphFrom, s.target, eased)
  if (t >= 1) {
    s.shown = s.target
    s.morphFrom = null
  }
  return true
}
