export function Placard() {
  return (
    <header className="placard">
      <h1>Learning Tic-Tac-Toe</h1>
      <p>
        This network learns to play tic-tac-toe from scratch.
        It watches games and notices which positions go on to become wins, draws, and losses.
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
