import type { Board as BoardT, Player } from '../model/types'

interface Props {
  board: BoardT
  humanTurn: boolean
  onCell: (move: number) => void
  /** Cell the network is currently considering (ghost mark), if any. */
  ghost: { move: number; player: Player; committing: boolean } | null
  /** Net's values for the human's candidate moves, when assist is on. */
  assist: Map<number, number> | null
  /** Cells of the winning line to highlight, if the game just ended. */
  winLine: number[] | null
  /** Per-mark contribution to the network's last verdict ("why?" overlay). */
  attribution: Map<number, number> | null
}

const MARK = { 1: 'X', '-1': 'O' } as const

export function Board({ board, humanTurn, onCell, ghost, assist, winLine, attribution }: Props) {
  return (
    <div className="board" data-disabled={!humanTurn}>
      {board.map((v, i) => {
        const ghostHere = ghost !== null && ghost.move === i && v === 0
        const attr = attribution?.get(i)
        const cls = [
          'cell',
          v !== 0 ? `mark-${v === 1 ? 'x' : 'o'}` : '',
          ghostHere ? (ghost.committing ? 'commit' : 'ghost') : '',
          winLine?.includes(i) ? 'win' : '',
          attr !== undefined ? `attr ${attr >= 0 ? 'attr-pos' : 'attr-neg'}` : '',
        ].join(' ')
        return (
          <button
            key={i}
            className={cls}
            disabled={!humanTurn || v !== 0}
            onClick={() => onCell(i)}
          >
            {v !== 0
              ? MARK[v === 1 ? 1 : '-1']
              : ghostHere
                ? MARK[ghost.player === 1 ? 1 : '-1']
                : ''}
            {v === 0 && !ghostHere && assist?.has(i) && (
              <span className={`assist ${assist.get(i)! >= 0 ? 'pos' : 'neg'}`}>
                {assist.get(i)! >= 0 ? '+' : ''}
                {assist.get(i)!.toFixed(2)}
              </span>
            )}
            {attr !== undefined && (
              <span className={`attr-badge ${attr >= 0 ? 'pos' : 'neg'}`}>
                {attr >= 0 ? '+' : ''}
                {attr.toFixed(2)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
