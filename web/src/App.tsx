import { useMemo, useState } from 'react'
import rawData from './data/checkpoints.json'
import type { Board as BoardT, CheckpointFile, Player } from './model/types'
import { applyMove, winningLine } from './model/game'
import { afterstateValues } from './model/net'
import { attribution } from './model/attribution'
import { influenceRanks } from './model/neurons'
import { topVotes } from './model/h2'
import { useGame } from './hooks/useGame'
import { useThinking } from './hooks/useThinking'
import { NetworkViz } from './viz/NetworkViz'
import type { Selection } from './viz/NetworkViz'
import { Gallery } from './viz/Gallery'
import { Board } from './components/Board'
import { Controls } from './components/Controls'
import { H2Card } from './components/H2Card'
import { NeuronCard } from './components/NeuronCard'
import { Placard } from './components/Placard'
import { Scrubber } from './components/Scrubber'
import { SkillChart } from './components/SkillChart'
import { StatCard } from './components/StatCard'

const data = rawData as unknown as CheckpointFile
const FINAL = data.checkpoints[data.checkpoints.length - 1]
// gallery slots in order of final-checkpoint influence (stable while scrubbing)
const GALLERY_ORDER = (() => {
  const ranks = influenceRanks(FINAL.weights)
  const order = new Array<number>(64)
  ranks.forEach((rank, n) => (order[rank] = n))
  return order
})()

interface LastNetMove {
  move: number
  value: number
  /** Board right after the network's move — the afterstate it judged. */
  board: BoardT
}

export default function App() {
  const [ckptIndex, setCkptIndex] = useState(data.checkpoints.length - 1)
  const [humanSide, setHumanSide] = useState<Player>(1)
  const [assist, setAssist] = useState(false)
  const [vizMode, setVizMode] = useState<'network' | 'gallery'>('network')
  const [selected, setSelected] = useState<Selection | null>(null)
  const [lastNetMove, setLastNetMove] = useState<LastNetMove | null>(null)
  const [showWhy, setShowWhy] = useState(false)
  const { board, toMove, result, play, reset } = useGame()

  const ckpt = data.checkpoints[ckptIndex]
  const netSide = -humanSide as Player

  const onNetMove = (move: number, value: number) => {
    setLastNetMove({ move, value, board: applyMove(board, move, netSide) })
    play(move)
  }
  const thinking = useThinking(ckpt.weights, board, toMove, netSide, result !== null, onNetMove)

  const humanTurn = result === null && toMove === humanSide && !thinking.active
  const assistValues = useMemo(() => {
    if (!assist || !humanTurn) return null
    return new Map(afterstateValues(ckpt.weights, board, humanSide).map((e) => [e.move, e.value]))
  }, [assist, humanTurn, ckpt.weights, board, humanSide])

  const attributionMap = useMemo(() => {
    if (!showWhy || lastNetMove === null) return null
    return new Map(
      attribution(ckpt.weights, lastNetMove.board, netSide).map((a) => [a.cell, a.contribution]),
    )
  }, [showWhy, lastNetMove, ckpt.weights, netSide])

  const clearTransients = () => {
    setLastNetMove(null)
    setShowWhy(false)
  }
  const humanPlay = (move: number) => {
    clearTransients()
    play(move)
  }
  const doReset = () => {
    clearTransients()
    reset()
  }
  const switchCkpt = (i: number) => {
    setCkptIndex(i)
    setSelected(null)
    clearTransients()
    reset()
  }

  // the verdict's strongest votes, shown once the output stage is revealed
  const votes = useMemo(() => {
    if (!thinking.current || thinking.reveal < 4) return null
    return topVotes(ckpt.weights, thinking.current.acts.h2, 3)
  }, [thinking, ckpt.weights])
  const switchSide = (s: Player) => {
    setHumanSide(s)
    clearTransients()
    reset()
  }

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
      : vizMode === 'gallery'
        ? 'every first-layer neuron, sorted by its pull on the verdict — scrub the timeline'
        : 'the network at rest — all 5,460 weights'

  const whyAvailable = lastNetMove !== null && !thinking.active && vizMode === 'network'

  return (
    <div className="app">
      <div className="main">
        <div className="left">
          <Placard />
          <div className="status">{status}</div>
          <Board
            board={board}
            humanTurn={humanTurn}
            onCell={humanPlay}
            ghost={
              thinking.current
                ? { move: thinking.current.move, player: netSide, committing: thinking.committing }
                : null
            }
            assist={assistValues}
            winLine={winningLine(board)}
            attribution={attributionMap}
          />
          <Controls
            humanSide={humanSide}
            onSide={switchSide}
            onReset={doReset}
            assist={assist}
            onAssist={setAssist}
          />
        </div>
        <div className="viz-panel">
          <div className="canvas-holder">
            {vizMode === 'network' ? (
              <NetworkViz
                weights={ckpt.weights}
                acts={thinking.current?.acts ?? null}
                reveal={thinking.reveal}
                selected={selected}
                onSelect={setSelected}
                voteHighlights={votes?.map((v) => v.neuron) ?? null}
              />
            ) : (
              <Gallery weights={ckpt.weights} sortOrder={GALLERY_ORDER} />
            )}
            {vizMode === 'network' && selected?.layer === 1 && (
              <NeuronCard
                weights={ckpt.weights}
                neuron={selected.n}
                acts={thinking.current?.acts ?? null}
                onClose={() => setSelected(null)}
              />
            )}
            {vizMode === 'network' && selected?.layer === 2 && (
              <H2Card
                weights={ckpt.weights}
                neuron={selected.n}
                acts={thinking.current?.acts ?? null}
                onClose={() => setSelected(null)}
              />
            )}
            <button
              className="mode-toggle"
              onClick={() => {
                setSelected(null)
                setVizMode(vizMode === 'network' ? 'gallery' : 'network')
              }}
            >
              {vizMode === 'network' ? 'see all 64 detectors' : 'back to the network'}
            </button>
          </div>
          <div className="caption-row">
            <div className="caption">{caption}</div>
            {whyAvailable && (
              <button className={showWhy ? 'why active' : 'why'} onClick={() => setShowWhy(!showWhy)}>
                {showWhy ? 'hide' : `why cell ${lastNetMove.move + 1}?`}
              </button>
            )}
          </div>
          <div className="vote-tally">
            {votes
              ? 'strongest votes on this verdict:  ' +
                votes
                  .map((v) => `neuron ${v.neuron + 1}: ${v.vote >= 0 ? '+' : ''}${v.vote.toFixed(2)}`)
                  .join('   ·   ')
              : ' '}
          </div>
        </div>
      </div>
      <div className="timeline">
        <div className="timeline-left">
          <SkillChart checkpoints={data.checkpoints} index={ckptIndex} onChange={switchCkpt} />
          <Scrubber checkpoints={data.checkpoints} index={ckptIndex} onChange={switchCkpt} />
        </div>
        <StatCard ckpt={ckpt} />
      </div>
    </div>
  )
}

function fmt(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`
}
