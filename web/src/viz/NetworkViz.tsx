// The network diagram: one DPR-aware canvas, redrawn by requestAnimationFrame.
// Weight changes (scrubbing the timeline) morph via a 600 ms lerp so visitors
// can watch edges strengthen and flip sign as the network learns. First-layer
// (h1) nodes are tappable: selecting one highlights its connections and opens
// a card describing what it has learned to detect.
import { useEffect, useRef } from 'react'
import type { Activations, Weights } from '../model/types'
import { makeLayout } from './layout'
import { buildDrawList, drawEdges, drawLabels, drawNodes, drawSelection } from './draw'
import { stepMorph, useMorphedWeights } from './useMorphedWeights'

interface Props {
  weights: Weights
  acts: Activations | null
  reveal: number
  selectedNeuron: number | null
  onSelectNeuron: (n: number | null) => void
}

export function NetworkViz({ weights, acts, reveal, selectedNeuron, onSelectNeuron }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const morph = useMorphedWeights(weights)
  const live = useRef({ acts, reveal, selected: selectedNeuron })
  live.current.acts = acts
  live.current.reveal = reveal
  live.current.selected = selectedNeuron
  const selectRef = useRef(onSelectNeuron)
  selectRef.current = onSelectNeuron

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let w = 0
    let h = 0
    let layout = makeLayout(1, 1)
    let drawList = buildDrawList(morph.current.shown, layout)
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

    const hitH1 = (e: PointerEvent | MouseEvent): number | null => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const r = layout.nodeR * 2.4
      for (let n = 0; n < 64; n++) {
        const p = layout.h1[n]
        if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r * r) return n
      }
      return null
    }
    const onClick = (e: MouseEvent) => {
      const n = hitH1(e)
      selectRef.current(n === live.current.selected ? null : n)
    }
    const onMove = (e: PointerEvent) => {
      canvas.style.cursor = hitH1(e) !== null ? 'pointer' : 'default'
    }
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('pointermove', onMove)

    const frame = (now: number) => {
      const s = live.current
      if (stepMorph(morph.current, now)) drawnFor = null
      if (drawnFor !== morph.current.shown) {
        drawList = buildDrawList(morph.current.shown, layout)
        drawnFor = morph.current.shown
      }
      ctx.clearRect(0, 0, w, h)
      drawEdges(ctx, drawList, s.reveal)
      drawNodes(ctx, layout, s.acts, s.reveal)
      if (s.selected !== null) drawSelection(ctx, layout, morph.current.shown, s.selected)
      drawLabels(ctx, layout, h)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('pointermove', onMove)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={canvasRef} className="network-canvas" />
}
