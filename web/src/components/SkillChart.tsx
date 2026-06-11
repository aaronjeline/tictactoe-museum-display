import type { Checkpoint } from '../model/types'

interface Props {
  checkpoints: Checkpoint[]
  index: number
  onChange: (index: number) => void
}

const W = 600
const H = 88
const PAD_X = 8
const PAD_Y = 10

export function SkillChart({ checkpoints, index, onChange }: Props) {
  const n = checkpoints.length
  const x = (i: number) => PAD_X + (i / (n - 1)) * (W - 2 * PAD_X)
  const y = (frac: number) => H - PAD_Y - frac * (H - 2 * PAD_Y)
  const series = [
    { key: 'takesWin' as const, color: 'var(--pos)', label: 'takes an available win' },
    { key: 'blocksThreat' as const, color: 'var(--neg)', label: 'blocks a threat' },
  ]
  return (
    <div className="skill-chart">
      <div className="skill-legend">
        {series.map((s) => (
          <span key={s.key}>
            <span className="dot" style={{ background: s.color }} /> {s.label}{' '}
            <strong>{(100 * checkpoints[index].stats.skills[s.key]).toFixed(0)}%</strong>
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1={x(index)} y1={2} x2={x(index)} y2={H - 2} className="cursor" />
        {series.map((s) => (
          <polyline
            key={s.key}
            points={checkpoints.map((c, i) => `${x(i)},${y(c.stats.skills[s.key])}`).join(' ')}
            style={{ stroke: s.color }}
          />
        ))}
        {checkpoints.map((c, i) => (
          <g key={c.id}>
            {series.map((s) => (
              <circle key={s.key} cx={x(i)} cy={y(c.stats.skills[s.key])} r={i === index ? 4 : 2.5} style={{ fill: s.color }} />
            ))}
            <rect
              x={x(i) - (W - 2 * PAD_X) / (2 * (n - 1))}
              y={0}
              width={(W - 2 * PAD_X) / (n - 1)}
              height={H}
              className="hit"
              onClick={() => onChange(i)}
            />
          </g>
        ))}
      </svg>
      <div className="skill-caption">
        watching random games teaches winning before defending; one generation of self-play
        fixes blocking
      </div>
    </div>
  )
}
