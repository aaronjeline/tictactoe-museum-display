import type { Checkpoint } from '../model/types'

function winRate(c: Checkpoint): { wins: number; losses: number; pct: string } {
  const { asX, asO, gamesPerSide } = c.stats.vsRandom
  const wins = asX.w + asO.w
  const losses = asX.l + asO.l
  return { wins, losses, pct: ((100 * wins) / (2 * gamesPerSide)).toFixed(0) }
}

export function StatCard({ ckpt }: { ckpt: Checkpoint }) {
  const { losses, pct } = winRate(ckpt)
  const blunders = ckpt.stats.losingBlunders
  return (
    <div className="stat-card">
      <div className="stat-title">{ckpt.label}</div>
      <dl>
        <div>
          <dt>games watched</dt>
          <dd>{ckpt.stats.gamesWatched.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>vs a random player</dt>
          <dd>
            {pct}% wins · {losses} losses
          </dd>
        </div>
        <div className={blunders === 0 ? 'good' : 'bad'}>
          <dt>game-losing mistakes</dt>
          <dd>
            {blunders.toLocaleString('en-US')}
            <span className="of"> in {ckpt.stats.positionsChecked.toLocaleString('en-US')} positions</span>
          </dd>
        </div>
        <div>
          <dt>skills</dt>
          <dd>
            takes wins {(100 * ckpt.stats.skills.takesWin).toFixed(0)}% ·{' '}
            blocks {(100 * ckpt.stats.skills.blocksThreat).toFixed(0)}%
          </dd>
        </div>
      </dl>
    </div>
  )
}
