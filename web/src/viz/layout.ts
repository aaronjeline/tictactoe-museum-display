// Node geometry for the network diagram, in canvas pixels.
// Inputs are drawn as two 3x3 grids — exactly the two encode() planes
// ("its pieces" / "opponent's pieces") — hidden layers as 8x8 grids.

export interface Pt {
  x: number
  y: number
}

export interface Layout {
  input: Pt[] // 18: indices 0-8 mine plane, 9-17 theirs plane
  h1: Pt[] // 64
  h2: Pt[] // 64
  out: Pt
  meter: { x: number; y0: number; y1: number; w: number }
  inputCell: number // input grid cell size
  nodeR: number // hidden node radius
}

function grid3(cx: number, cy: number, pitch: number): Pt[] {
  const pts: Pt[] = []
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) pts.push({ x: cx + (c - 1) * pitch, y: cy + (r - 1) * pitch })
  return pts
}

function grid8(cx: number, cy: number, pitch: number): Pt[] {
  const pts: Pt[] = []
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      pts.push({ x: cx + (c - 3.5) * pitch, y: cy + (r - 3.5) * pitch })
  return pts
}

export function makeLayout(w: number, h: number): Layout {
  const cy = h * 0.52
  const inPitch = Math.min(w * 0.035, h * 0.085)
  const hidPitch = Math.min(w * 0.028, h * 0.1)
  return {
    input: [
      ...grid3(w * 0.09, h * 0.3, inPitch),
      ...grid3(w * 0.09, h * 0.74, inPitch),
    ],
    h1: grid8(w * 0.4, cy, hidPitch),
    h2: grid8(w * 0.66, cy, hidPitch),
    out: { x: w * 0.875, y: cy },
    meter: { x: w * 0.945, y0: h * 0.18, y1: h * 0.86, w: w * 0.018 },
    inputCell: inPitch * 0.62,
    nodeR: hidPitch * 0.3,
  }
}
