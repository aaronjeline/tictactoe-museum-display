import type { Player } from '../model/types'

interface Props {
  humanSide: Player
  onSide: (side: Player) => void
  onReset: () => void
  assist: boolean
  onAssist: (on: boolean) => void
}

export function Controls({ humanSide, onSide, onReset, assist, onAssist }: Props) {
  return (
    <div className="controls">
      <div className="side-picker">
        <span className="label">You play</span>
        <button className={humanSide === 1 ? 'active' : ''} onClick={() => onSide(1)}>
          X
        </button>
        <button className={humanSide === -1 ? 'active' : ''} onClick={() => onSide(-1)}>
          O
        </button>
      </div>
      <button onClick={onReset}>New game</button>
      <button className={assist ? 'active' : ''} onClick={() => onAssist(!assist)}>
        {assist ? 'Hints on' : 'Hints off'}
      </button>
    </div>
  )
}
