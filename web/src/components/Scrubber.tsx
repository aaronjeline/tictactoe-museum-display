import type { Checkpoint } from '../model/types'

interface Props {
  checkpoints: Checkpoint[]
  index: number
  onChange: (index: number) => void
}

export function Scrubber({ checkpoints, index, onChange }: Props) {
  return (
    <div className="scrubber">
      <div className="scrubber-head">
        <span className="label">training timeline</span>
        <span className="hint">drag to play the network at any point in its education</span>
      </div>
      <input
        type="range"
        min={0}
        max={checkpoints.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="ticks">
        {checkpoints.map((c, i) => (
          <span key={c.id} className={i === index ? 'tick active' : 'tick'} onClick={() => onChange(i)}>
            {c.gen < 0 ? 'untrained' : c.gen}
          </span>
        ))}
      </div>
    </div>
  )
}
