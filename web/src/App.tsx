import { useMemo, useState } from 'react'
import rawData from './data/checkpoints.json'
import type { CheckpointFile, Player } from './model/types'
import { winningLine } from './model/game'
import { afterstateValues } from './model/net'
import { useGame } from './hooks/useGame'
import { useThinking } from './hooks/useThinking'
import { NetworkViz } from './viz/NetworkViz'
import { Board } from './components/Board'
import { Controls } from './components/Controls'
import { Placard } from './components/Placard'
import { Scrubber } from './components/Scrubber'
import { StatCard } from './components/StatCard'

const data = rawData as unknown as CheckpointFile

export default function App() {
  const [ckptIndex, setCkptIndex] = useState(data.checkpoints.length - 1)
  const [humanSide, setHumanSide] = useState<Player>(1)
  const [assist, setAssist] = useState(false)
  const { board, toMove, result, play, reset } = useGame()

  const ckpt = data.checkpoints[ckptIndex]
  const netSide = -humanSide as Player
  const thinking = useThinking(ckpt.weights, board, toMove, netSide, result !== null, play)

  const humanTurn = result === null && toMove === humanSide && !thinking.active
  const assistValues = useMemo(() => {
    if (!assist || !humanTurn) return null
    return new Map(afterstateValues(ckpt.weights, board, humanSide).map((e) => [e.move, e.value]))
  }, [assist, humanTurn, ckpt.weights, board, humanSide])

  const status =
    result !== null
      ? result === 0
        ? 'A draw.'
        : result === humanSide
          ? 'You win! (Try a later checkpoint…)'
          : 'The network wins.'
      : thinking.active
        ? 'The network is thinking…'
        : 'Your move — tap a cell.'

  const caption =
    thinking.active && thinking.current
      ? thinking.committing
        ? `plays cell ${thinking.current.move + 1} (${fmt(thinking.current.value)})`
        : `trying cell ${thinking.current.move + 1}` +
          (thinking.reveal >= 4 ? ` → ${fmt(thinking.current.value)}` : ' …') +
          (thinking.best
            ? `   ·   best so far: cell ${thinking.best.move + 1} (${fmt(thinking.best.value)})`
            : '')
      : 'the network at rest — all 5,460 weights'

  const switchCkpt = (i: number) => {
    setCkptIndex(i)
    reset()
  }
  const switchSide = (s: Player) => {
    setHumanSide(s)
    reset()
  }

  return (
    <div className="app">
      <div className="main">
        <div className="left">
          <Placard />
          <div className="status">{status}</div>
          <Board
            board={board}
            humanTurn={humanTurn}
            onCell={play}
            ghost={
              thinking.current
                ? { move: thinking.current.move, player: netSide, committing: thinking.committing }
                : null
            }
            assist={assistValues}
            winLine={winningLine(board)}
          />
          <Controls
            humanSide={humanSide}
            onSide={switchSide}
            onReset={reset}
            assist={assist}
            onAssist={setAssist}
          />
        </div>
        <div className="viz-panel">
          <div className="canvas-holder">
            <NetworkViz
              weights={ckpt.weights}
              acts={thinking.current?.acts ?? null}
              reveal={thinking.reveal}
            />
          </div>
          <div className="legend">
            each line is one learned weight connecting two neurons —{' '}
            <span className="swatch pos" /> positive: signal through it raises the next
            neuron's activity · <span className="swatch neg" /> negative: lowers it ·
            brighter = stronger
          </div>
          <div className="caption">{caption}</div>
        </div>
      </div>
      <div className="timeline">
        <Scrubber checkpoints={data.checkpoints} index={ckptIndex} onChange={switchCkpt} />
        <StatCard ckpt={ckpt} />
      </div>
    </div>
  )
}

function fmt(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`
}
