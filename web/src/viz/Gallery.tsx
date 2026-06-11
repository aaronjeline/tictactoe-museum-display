// The detector gallery: all 64 first-layer neurons as receptive-field cards
// (two 3x3 plane heatmaps each), sorted by their influence on the verdict at
// the final checkpoint so the layout is stable while scrubbing. Scrub the
// timeline and watch the detectors crystallize out of initialization noise.
import { useEffect, useRef } from 'react'
import type { Weights } from '../model/types'
import { NEG, POS } from './draw'
import { stepMorph, useMorphedWeights } from './useMorphedWeights'

interface Props {
  weights: Weights
  /** Display order: sortOrder[gridSlot] = neuron index. */
  sortOrder: number[]
}

export function Gallery({ weights, sortOrder }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const morph = useMorphedWeights(weights)
  const orderRef = useRef(sortOrder)
  orderRef.current = sortOrder

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let w = 0
    let h = 0

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
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement!)

    const drawCard = (W1: number[], n: number, x: number, y: number, card: number) => {
      const row = W1.slice(n * 18, n * 18 + 18)
      let max = 1e-9
      for (const v of row) max = Math.max(max, Math.abs(v))
      const cell = card / 7.5 // 3 cells + gap, two planes side by side
      for (let plane = 0; plane < 2; plane++) {
        for (let i = 0; i < 9; i++) {
          const v = row[plane * 9 + i]
          ctx.globalAlpha = 0.1 + 0.9 * (Math.abs(v) / max)
          ctx.fillStyle = v >= 0 ? POS : NEG
          ctx.fillRect(
            x + plane * cell * 4 + (i % 3) * cell,
            y + Math.floor(i / 3) * cell,
            cell * 0.88,
            cell * 0.88,
          )
        }
      }
    }

    const frame = (now: number) => {
      stepMorph(morph.current, now)
      const W1 = morph.current.shown.W1
      ctx.clearRect(0, 0, w, h)
      const cols = 8
      const rows = 8
      const pad = Math.min(w, h) * 0.03
      const cardW = (w - pad * 2) / cols
      const cardH = (h - pad * 2) / rows
      const card = Math.min(cardW * 0.78, cardH * 0.72)
      for (let slot = 0; slot < 64; slot++) {
        const n = orderRef.current[slot]
        const cx = pad + (slot % cols) * cardW + (cardW - card) / 2
        const cy = pad + Math.floor(slot / cols) * cardH + (cardH - card * 0.45) / 2
        drawCard(W1, n, cx, cy, card)
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={canvasRef} className="network-canvas" />
}
