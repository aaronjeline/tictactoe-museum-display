// The network diagram: one DPR-aware canvas, redrawn by requestAnimationFrame.
// Weight changes (scrubbing the timeline) morph via a 600 ms lerp so visitors
// can watch edges strengthen and flip sign as the network learns.
import { useEffect, useRef } from 'react'
import type { Activations, Weights } from '../model/types'
import { makeLayout } from './layout'
import { buildDrawList, drawEdges, drawLabels, drawNodes } from './draw'

const MORPH_MS = 600

interface Props {
  weights: Weights
  acts: Activations | null
  reveal: number
}

function lerpWeights(a: Weights, b: Weights, t: number): Weights {
  const mix = (u: number[], v: number[]) => u.map((x, i) => x + (v[i] - x) * t)
  return {
    W1: mix(a.W1, b.W1), b1: mix(a.b1, b.b1),
    W2: mix(a.W2, b.W2), b2: mix(a.b2, b.b2),
    W3: mix(a.W3, b.W3), b3: mix(a.b3, b.b3),
  }
}

export function NetworkViz({ weights, acts, reveal }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Mutable state read by the rAF loop; updated from props without re-render churn.
  const live = useRef({
    target: weights,
    shown: weights,
    morphFrom: null as Weights | null,
    morphStart: 0,
    acts,
    reveal,
  })

  live.current.acts = acts
  live.current.reveal = reveal
  if (live.current.target !== weights) {
    live.current.morphFrom = live.current.shown
    live.current.morphStart = performance.now()
    live.current.target = weights
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let w = 0
    let h = 0
    let layout = makeLayout(1, 1)
    let drawList = buildDrawList(live.current.shown, layout)
    let drawnFor: Weights | null = null

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      layout = makeLayout(w, h)
      drawnFor = null
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement!)

    const frame = (now: number) => {
      const s = live.current
      if (s.morphFrom !== null) {
        const t = Math.min(1, (now - s.morphStart) / MORPH_MS)
        const eased = t * (2 - t)
        s.shown = lerpWeights(s.morphFrom, s.target, eased)
        if (t >= 1) {
          s.shown = s.target
          s.morphFrom = null
        }
        drawnFor = null
      }
      if (drawnFor !== s.shown) {
        drawList = buildDrawList(s.shown, layout)
        drawnFor = s.shown
      }
      ctx.clearRect(0, 0, w, h)
      drawEdges(ctx, drawList, s.reveal)
      drawNodes(ctx, layout, s.acts, s.reveal)
      drawLabels(ctx, layout, h)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="network-canvas" />
}
