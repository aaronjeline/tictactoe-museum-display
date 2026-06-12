import { useMemo } from 'react'
import type { Activations, Board, Player, Weights } from '../model/types'
import { analyzeH2 } from '../model/h2'

interface Props {
  weights: Weights
  neuron: number
  acts: Activations | null
  onClose: () => void
}

function MiniBoard({ board, mover }: { board: Board; mover: Player }) {
  return (
    <div className="mini-board">
      {board.map((v, i) => (
        <div key={i} className={`mini-cell ${v === mover ? 'pos' : v === 0 ? '' : 'neg'}`}>
          {v === 0 ? '' : v === mover ? '×' : '○'}
        </div>
      ))}
    </div>
  )
}

export function H2Card({ weights, neuron, acts, onClose }: Props) {
  const info = useMemo(() => analyzeH2(weights)[neuron], [weights, neuron])
  const activation = acts ? acts.h2[neuron] : null
  const dead = info.activeFrac < 0.005

  return (
    <div className="neuron-card">
      <button className="close" onClick={onClose}>
        ×
      </button>
      <div className="neuron-title">second layer · neuron {neuron + 1} of 64</div>
      {dead ? (
        <div className="neuron-caption">
          training left this neuron unused — it almost never fires, and its vote on the
          verdict is negligible
        </div>
      ) : (
        <>
          <div className="neuron-caption">
            {info.label === 'win detector' &&
              'a win detector — its activity tracks "the mover just completed a line"'}
            {info.label === 'threat alarm' &&
              'a threat alarm — its activity tracks "the opponent has a winning reply"'}
            {info.label === null && 'a mixed feature — no single concept dominates its activity'}
          </div>
          <div className="plane-title">the boards it fires hardest on (× = the mover):</div>
          <div className="mini-boards">
            {info.topBoards.map((t, i) => (
              <MiniBoard key={i} board={t.board} mover={t.mover} />
            ))}
          </div>
        </>
      )}
      <div className="neuron-meta">
        votes <span className={info.vote >= 0 ? 'pos' : 'neg'}>
          {info.vote >= 0 ? 'toward "win"' : 'toward "lose"'}
        </span>{' '}
        ({info.vote >= 0 ? '+' : ''}
        {info.vote.toFixed(2)} per unit of activity) · fires on{' '}
        {(100 * info.activeFrac).toFixed(0)}% of positions
        {activation !== null && <span> · firing now: {activation.toFixed(2)}</span>}
      </div>
    </div>
  )
}
