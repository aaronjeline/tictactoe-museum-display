// The "watch it think" state machine. When it's the network's turn, step
// through every legal candidate move: ghost the mark on the board, reveal
// the activations flowing layer by layer, show the verdict on the meter,
// then play the best one. The pacing is museum-deliberate on purpose.
import { useEffect, useRef, useState } from 'react'
import { afterstateValues } from '../model/net'
import type { CandidateEval } from '../model/net'
import type { Board, Player, Weights } from '../model/types'

const STAGE_MS = 90 // input -> h1 -> h2 -> output reveal interval
const CANDIDATE_MS = 420 // time per candidate move
const COMMIT_MS = 550 // pause on the chosen move before playing it

export interface Thinking {
  active: boolean
  /** Candidate currently being considered (ghosted on the board). */
  current: CandidateEval | null
  /** 0 none, 1 input, 2 h1, 3 h2, 4 output revealed. */
  reveal: number
  /** Best candidate seen so far (first-max). */
  best: CandidateEval | null
  /** Set during the final flash on the chosen cell. */
  committing: boolean
}

const IDLE: Thinking = { active: false, current: null, reveal: 0, best: null, committing: false }

export function useThinking(
  weights: Weights,
  board: Board,
  toMove: Player,
  netSide: Player,
  gameOver: boolean,
  onMove: (move: number, value: number) => void,
) {
  const [state, setState] = useState<Thinking>(IDLE)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  const netTurn = !gameOver && toMove === netSide
  const boardKey = board.join('')

  useEffect(() => {
    if (!netTurn) {
      setState(IDLE)
      return
    }
    const evals = afterstateValues(weights, board, netSide)
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))

    let best = evals[0]
    evals.forEach((cand, i) => {
      const t0 = i * CANDIDATE_MS
      if (cand.value > best.value) best = cand
      const bestSoFar = best
      at(t0, () => setState({ active: true, current: cand, reveal: 1, best: i === 0 ? null : bestSoFar, committing: false }))
      for (let stage = 2; stage <= 4; stage++) {
        at(t0 + (stage - 1) * STAGE_MS, () =>
          setState((s) => (s.current === cand ? { ...s, reveal: stage, best: bestSoFar } : s)),
        )
      }
    })
    const tEnd = evals.length * CANDIDATE_MS
    const chosen = best
    at(tEnd, () =>
      setState({ active: true, current: chosen, reveal: 4, best: chosen, committing: true }),
    )
    at(tEnd + COMMIT_MS, () => onMoveRef.current(chosen.move, chosen.value))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netTurn, boardKey, netSide, weights])

  return state
}
