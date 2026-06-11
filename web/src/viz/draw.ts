// Canvas rendering for the network: 5,248 weight edges drawn as batched
// strokes (bucketed by sign and quantized opacity), nodes glowing with the
// current forward pass's activations.
import type { Activations, Weights } from '../model/types'
import type { Layout, Pt } from './layout'

export const POS = '#5ec8f8' // positive weight / value
export const NEG = '#ffa94d' // negative weight / value
export const BG = '#0a0a0f'
const TEXT_DIM = 'rgba(232,232,240,0.42)'

const ALPHA_LEVELS = 7
const MIN_ALPHA = 0.16 // edges fainter than this are skipped
const TOP_EDGES = 28 // per layer, drawn emphasized

interface LayerSpec {
  W: number[]
  nIn: number
  nOut: number
  from: Pt[]
  to: Pt[]
}

interface Bucket {
  alpha: number
  color: string
  edges: number[] // edge index = o * nIn + i
}

export interface DrawList {
  layers: { spec: LayerSpec; buckets: Bucket[]; top: number[] }[]
}

function layerSpecs(w: Weights, lay: Layout): LayerSpec[] {
  const outPt = [lay.out]
  return [
    { W: w.W1, nIn: 18, nOut: 64, from: lay.input, to: lay.h1 },
    { W: w.W2, nIn: 64, nOut: 64, from: lay.h1, to: lay.h2 },
    { W: w.W3, nIn: 64, nOut: 1, from: lay.h2, to: outPt },
  ]
}

export function buildDrawList(w: Weights, lay: Layout): DrawList {
  const layers = layerSpecs(w, lay).map((spec) => {
    let max = 1e-9
    for (const v of spec.W) max = Math.max(max, Math.abs(v))
    const buckets: Bucket[] = []
    for (let q = 0; q < ALPHA_LEVELS; q++) {
      const alpha = MIN_ALPHA + ((1 - MIN_ALPHA) * (q + 0.5)) / ALPHA_LEVELS
      buckets.push({ alpha, color: POS, edges: [] }, { alpha, color: NEG, edges: [] })
    }
    const ranked: { e: number; a: number }[] = []
    for (let e = 0; e < spec.W.length; e++) {
      const a = Math.abs(spec.W[e]) / max
      if (a < MIN_ALPHA) continue
      ranked.push({ e, a })
      let q = Math.floor(((a - MIN_ALPHA) / (1 - MIN_ALPHA)) * ALPHA_LEVELS)
      if (q >= ALPHA_LEVELS) q = ALPHA_LEVELS - 1
      buckets[q * 2 + (spec.W[e] >= 0 ? 0 : 1)].edges.push(e)
    }
    ranked.sort((p, r) => r.a - p.a)
    return { spec, buckets, top: ranked.slice(0, TOP_EDGES).map((r) => r.e) }
  })
  return { layers }
}

function strokeEdges(
  ctx: CanvasRenderingContext2D,
  spec: LayerSpec,
  edges: number[],
): void {
  ctx.beginPath()
  for (const e of edges) {
    const o = Math.floor(e / spec.nIn)
    const i = e % spec.nIn
    ctx.moveTo(spec.from[i].x, spec.from[i].y)
    ctx.lineTo(spec.to[o].x, spec.to[o].y)
  }
  ctx.stroke()
}

export function drawEdges(ctx: CanvasRenderingContext2D, dl: DrawList, reveal: number): void {
  dl.layers.forEach((layer, li) => {
    // a layer's edges pulse brighter while activations cross them
    const pulse = reveal === li + 2 ? 1.7 : 1
    ctx.lineWidth = 1
    for (const b of layer.buckets) {
      if (b.edges.length === 0) continue
      ctx.globalAlpha = Math.min(1, b.alpha * 0.6 * pulse)
      ctx.strokeStyle = b.color
      strokeEdges(ctx, layer.spec, b.edges)
    }
    ctx.lineWidth = 1.7
    ctx.globalAlpha = Math.min(1, 0.75 * pulse)
    for (const e of layer.top) {
      ctx.strokeStyle = layer.spec.W[e] >= 0 ? POS : NEG
      strokeEdges(ctx, layer.spec, [e])
    }
  })
  ctx.globalAlpha = 1
}

function maxOf(v: number[]): number {
  let m = 1e-9
  for (const x of v) if (x > m) m = x
  return m
}

export function drawNodes(
  ctx: CanvasRenderingContext2D,
  lay: Layout,
  acts: Activations | null,
  reveal: number,
): void {
  // input planes: squares, lit when that cell is 1
  for (let i = 0; i < 18; i++) {
    const p = lay.input[i]
    const s = lay.inputCell
    const lit = acts !== null && reveal >= 1 && acts.input[i] > 0.5
    ctx.globalAlpha = lit ? 1 : 0.55
    ctx.fillStyle = lit ? (i < 9 ? POS : NEG) : 'rgba(232,232,240,0.22)'
    if (lit) {
      ctx.shadowColor = i < 9 ? POS : NEG
      ctx.shadowBlur = 12
    }
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
    ctx.shadowBlur = 0
  }
  // hidden layers: circles glowing with activation
  const hidden: [number[], typeof lay.h1, number][] = [
    [acts ? acts.h1 : [], lay.h1, 2],
    [acts ? acts.h2 : [], lay.h2, 3],
  ]
  for (const [vals, pts, stage] of hidden) {
    const on = acts !== null && reveal >= stage
    const max = on ? maxOf(vals) : 1
    for (let i = 0; i < 64; i++) {
      const a = on ? vals[i] / max : 0
      const p = pts[i]
      ctx.beginPath()
      ctx.arc(p.x, p.y, lay.nodeR * (1 + a * 0.7), 0, Math.PI * 2)
      ctx.globalAlpha = 0.5 + 0.5 * a
      ctx.fillStyle = a > 0.01 ? POS : 'rgba(232,232,240,0.38)'
      if (a > 0.55) {
        ctx.shadowColor = POS
        ctx.shadowBlur = 10
      }
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }
  // output node + meter
  const v = acts !== null && reveal >= 4 ? acts.value : null
  const p = lay.out
  ctx.beginPath()
  ctx.arc(p.x, p.y, lay.nodeR * 3.2, 0, Math.PI * 2)
  if (v === null) {
    ctx.globalAlpha = 0.6
    ctx.fillStyle = 'rgba(232,232,240,0.35)'
    ctx.fill()
  } else {
    ctx.globalAlpha = 0.25 + 0.75 * Math.abs(v)
    ctx.fillStyle = v >= 0 ? POS : NEG
    ctx.shadowColor = ctx.fillStyle
    ctx.shadowBlur = 18
    ctx.fill()
    ctx.shadowBlur = 0
  }
  drawMeter(ctx, lay, v)
  ctx.globalAlpha = 1
}

function drawMeter(ctx: CanvasRenderingContext2D, lay: Layout, v: number | null): void {
  const m = lay.meter
  const mid = (m.y0 + m.y1) / 2
  ctx.globalAlpha = 1
  ctx.strokeStyle = 'rgba(232,232,240,0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(m.x, m.y0, m.w, m.y1 - m.y0)
  ctx.beginPath()
  ctx.moveTo(m.x - 3, mid)
  ctx.lineTo(m.x + m.w + 3, mid)
  ctx.stroke()
  if (v !== null) {
    const half = (m.y1 - m.y0) / 2
    const y = mid - v * half
    ctx.fillStyle = v >= 0 ? POS : NEG
    ctx.globalAlpha = 0.85
    ctx.fillRect(m.x + 1, Math.min(y, mid), m.w - 2, Math.abs(y - mid))
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = TEXT_DIM
  ctx.font = '12px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('win', m.x + m.w / 2, m.y0 - 8)
  ctx.fillText('lose', m.x + m.w / 2, m.y1 + 16)
}

export function drawLabels(ctx: CanvasRenderingContext2D, lay: Layout, h: number): void {
  ctx.fillStyle = TEXT_DIM
  ctx.font = '13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('its pieces', lay.input[4].x, lay.input[0].y - lay.inputCell * 1.4)
  ctx.fillText("opponent's", lay.input[13].x, lay.input[9].y - lay.inputCell * 1.4)
  ctx.fillText('64 neurons — tap one', lay.h1[3].x + (lay.h1[4].x - lay.h1[3].x) / 2, h * 0.97)
  ctx.fillText('64 neurons', lay.h2[3].x + (lay.h2[4].x - lay.h2[3].x) / 2, h * 0.97)
  ctx.fillText('verdict', lay.out.x, h * 0.97)
}

/** Highlight one h1 neuron: ring it and draw its incoming/outgoing weights
 * at full strength on top of the ambient picture. */
export function drawSelection(
  ctx: CanvasRenderingContext2D,
  lay: Layout,
  w: Weights,
  n: number,
): void {
  const p = lay.h1[n]
  // incoming from the input planes
  let maxIn = 1e-9
  for (let i = 0; i < 18; i++) maxIn = Math.max(maxIn, Math.abs(w.W1[n * 18 + i]))
  ctx.lineWidth = 1.8
  for (let i = 0; i < 18; i++) {
    const v = w.W1[n * 18 + i]
    ctx.globalAlpha = Math.min(1, (Math.abs(v) / maxIn) * 0.95)
    ctx.strokeStyle = v >= 0 ? POS : NEG
    ctx.beginPath()
    ctx.moveTo(lay.input[i].x, lay.input[i].y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }
  // outgoing into h2
  let maxOut = 1e-9
  for (let j = 0; j < 64; j++) maxOut = Math.max(maxOut, Math.abs(w.W2[j * 64 + n]))
  ctx.lineWidth = 1.2
  for (let j = 0; j < 64; j++) {
    const v = w.W2[j * 64 + n]
    const a = Math.abs(v) / maxOut
    if (a < 0.25) continue
    ctx.globalAlpha = a * 0.8
    ctx.strokeStyle = v >= 0 ? POS : NEG
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(lay.h2[j].x, lay.h2[j].y)
    ctx.stroke()
  }
  // selection ring
  ctx.globalAlpha = 1
  ctx.strokeStyle = '#e8e8f0'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(p.x, p.y, lay.nodeR * 2.4, 0, Math.PI * 2)
  ctx.stroke()
}
