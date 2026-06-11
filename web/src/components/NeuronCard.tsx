import { useMemo } from 'react'
import type { Activations, Weights } from '../model/types'
import { influenceRanks, lineCaption, receptiveField } from '../model/neurons'

interface Props {
  weights: Weights
  neuron: number
  acts: Activations | null
  onClose: () => void
}

function Plane({ title, w }: { title: string; w: number[] }) {
  const max = Math.max(...w.map(Math.abs), 1e-9)
  return (
    <div className="plane">
      <div className="plane-title">{title}</div>
      <div className="plane-grid">
        {w.map((v, i) => (
          <div
            key={i}
            className="plane-cell"
            style={{
              background: v >= 0 ? 'var(--pos)' : 'var(--neg)',
              opacity: 0.12 + 0.88 * (Math.abs(v) / max),
            }}
          />
        ))}
      </div>
    </div>
  )
}

export function NeuronCard({ weights, neuron, acts, onClose }: Props) {
  const field = useMemo(() => receptiveField(weights, neuron), [weights, neuron])
  const rank = useMemo(() => influenceRanks(weights)[neuron], [weights, neuron])
  const caption = useMemo(() => lineCaption(field), [field])
  const activation = acts ? acts.h1[neuron] : null

  return (
    <div className="neuron-card">
      <button className="close" onClick={onClose}>
        ×
      </button>
      <div className="neuron-title">neuron {neuron + 1} of 64</div>
      <div className="planes">
        <Plane title="its pieces" w={field.mine} />
        <Plane title="opponent's" w={field.theirs} />
      </div>
      <div className="neuron-caption">
        {caption ?? 'a mixed pattern — no single line dominates'}
      </div>
      <div className="neuron-meta">
        #{rank + 1} of 64 in pull on the verdict
        {activation !== null && (
          <span> · firing now: {activation.toFixed(2)}</span>
        )}
      </div>
      <div className="neuron-hint">
        <span className="pos">blue</span>: a mark here excites it ·{' '}
        <span className="neg">orange</span>: suppresses it
      </div>
    </div>
  )
}
