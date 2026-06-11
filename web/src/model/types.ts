/** X = 1, O = -1, empty = 0; board is 9 cells in reading order. */
export type Player = 1 | -1
export type Cell = number
export type Board = number[]

export interface Weights {
  W1: number[] // [64][18] row-major
  b1: number[]
  W2: number[] // [64][64] row-major
  b2: number[]
  W3: number[] // [1][64] row-major
  b3: number[]
}

export interface SideRecord {
  w: number
  d: number
  l: number
}

export interface Skills {
  /** Fraction of value-required immediate wins the greedy net takes. */
  takesWin: number
  /** Fraction of must-block single threats (in non-lost positions) it blocks. */
  blocksThreat: number
  winPositions: number
  blockPositions: number
}

export interface CheckpointStats {
  gamesWatched: number
  loss: number | null
  vsRandom: { asX: SideRecord; asO: SideRecord; gamesPerSide: number }
  losingBlunders: number
  missedWins: number
  positionsChecked: number
  skills: Skills
}

export interface Checkpoint {
  id: string
  gen: number
  label: string
  stats: CheckpointStats
  weights: Weights
}

export interface TestVector {
  checkpointId: string
  board: number[]
  mover: number
  expected: { move: number; value: number }[]
  /** Python's greedy (first-max) choice. */
  chosen: number
}

export interface CheckpointFile {
  schemaVersion: number
  hidden: number
  checkpoints: Checkpoint[]
  testVectors: TestVector[]
}

/** All activations from one forward pass, for the data-flow visualization. */
export interface Activations {
  input: number[] // 18
  h1: number[] // 64
  h2: number[] // 64
  value: number // tanh output in [-1, 1]
}
