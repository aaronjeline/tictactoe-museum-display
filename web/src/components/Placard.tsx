export function Placard() {
  return (
    <header className="placard">
      <h1>Learning Tic-Tac-Toe by Watching</h1>
      <p>
        This network was never told how to play — no rules of thumb, no perfect teacher. It
        watched games and noticed which positions went on to become wins, draws, and losses.
      </p>
      <p>
        <strong>How it plays:</strong> the network is trained to do exactly one thing: given a
        board, predict how the game will end for it (<span className="pos">+1 win</span> …{' '}
        <span className="neg">−1 lose</span>). To pick a move, it tries every legal move, runs
        each resulting board through that prediction, and plays the one with the highest
        score. 
      </p>
    </header>
  )
}
