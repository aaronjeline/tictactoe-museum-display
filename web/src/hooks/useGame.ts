import { useReducer } from 'react'
import { applyMove, newBoard, winner } from '../model/game'
import type { Board, Player } from '../model/types'

export interface GameState {
  board: Board
  toMove: Player
}

type Action = { type: 'play'; move: number } | { type: 'reset' }

function reducer(state: GameState, action: Action): GameState {
  if (action.type === 'reset') return { board: newBoard(), toMove: 1 }
  if (winner(state.board) !== null || state.board[action.move] !== 0) return state
  return {
    board: applyMove(state.board, action.move, state.toMove),
    toMove: -state.toMove as Player,
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(reducer, { board: newBoard(), toMove: 1 as Player })
  return {
    board: state.board,
    toMove: state.toMove,
    result: winner(state.board), // 1 | -1 | 0 (draw) | null (ongoing)
    play: (move: number) => dispatch({ type: 'play', move }),
    reset: () => dispatch({ type: 'reset' }),
  }
}
