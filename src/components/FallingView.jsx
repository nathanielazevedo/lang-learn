import { useEffect, useRef, useState } from 'react'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildRound(pool) {
  const card = pool[Math.floor(Math.random() * pool.length)]
  const distractors = shuffle(pool.filter((c) => c.translation !== card.translation))
    .slice(0, 3)
    .map((c) => c.translation)
  return { card, options: shuffle([card.translation, ...distractors]) }
}

// Seconds for a word to fall, shrinking as the score climbs (gets harder).
function fallDuration(score) {
  return Math.max(2.6, 7 - score * 0.12)
}

const START_LIVES = 3

// Arcade mode: pinyin words fall from the top; tap the matching English before
// they hit the bottom. Wrong tap or a missed word costs a life.
export default function FallingView({ cards, label, onExit }) {
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [running, setRunning] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [best, setBest] = useState(() => Number(localStorage.getItem('langlearn.falling.best') || 0))
  const [round, setRound] = useState(null) // { card, options }
  const [pos, setPos] = useState(0) // 0..100 vertical position
  const [feedback, setFeedback] = useState(null) // 'correct' | 'wrong'

  const posRef = useRef(0)
  const scoreRef = useRef(0)
  const livesRef = useRef(START_LIVES)
  const flashTimer = useRef(null)

  function flash(kind) {
    setFeedback(kind)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFeedback(null), 220)
  }

  function spawn() {
    posRef.current = 0
    setPos(0)
    setRound(buildRound(cards))
  }

  function endGame() {
    setRunning(false)
    setGameOver(true)
    setRound(null)
    setBest((b) => {
      const nb = Math.max(b, scoreRef.current)
      localStorage.setItem('langlearn.falling.best', String(nb))
      return nb
    })
  }

  function loseLife() {
    flash('wrong')
    livesRef.current -= 1
    setLives(livesRef.current)
    if (livesRef.current <= 0) endGame()
    else spawn()
  }

  function start() {
    scoreRef.current = 0
    livesRef.current = START_LIVES
    setScore(0)
    setLives(START_LIVES)
    setGameOver(false)
    setRunning(true)
    spawn()
  }

  function answer(option) {
    if (!round || !running) return
    if (option === round.card.translation) {
      const gained = Math.max(1, Math.ceil((100 - posRef.current) / 12)) // catch higher = more points
      scoreRef.current += gained
      setScore(scoreRef.current)
      flash('correct')
      spawn()
    } else {
      loseLife()
    }
  }

  // Falling animation + bottom-collision, driven by the score-based speed.
  useEffect(() => {
    if (!running || !round) return
    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = now - last
      last = now
      posRef.current += (100 / (fallDuration(scoreRef.current) * 1000)) * dt
      if (posRef.current >= 100) {
        setPos(100)
        loseLife() // hit the bottom
        return
      }
      setPos(posRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, round])

  useEffect(() => () => clearTimeout(flashTimer.current), [])

  // --- Intro / game-over screens ---
  if (!running) {
    return (
      <div className="session done">
        <h2>{gameOver ? 'Game over' : '🕹️ Falling Words'}</h2>
        {gameOver ? (
          <>
            <div className="score-ring">{score}</div>
            <p className="muted">Best: {best}</p>
          </>
        ) : (
          <p className="muted">
            Tap the English meaning before each pinyin word hits the bottom.<br />
            A wrong tap or a missed word costs a life. You have {START_LIVES}.
          </p>
        )}
        <div className="intro-actions">
          <button className="primary wide" onClick={start}>
            {gameOver ? '↻ Play again' : '▶ Start'}
          </button>
          <button className="wide" onClick={onExit}>Back to dashboard</button>
        </div>
      </div>
    )
  }

  // --- Active game ---
  return (
    <div className="session falling">
      <div className="session-top">
        <button className="ghost" onClick={onExit}>← Exit</button>
        <span className="hud">
          <span className="hud-score">⭐ {score}</span>
          <span className="hud-lives">{'❤️'.repeat(lives)}{'🤍'.repeat(Math.max(0, START_LIVES - lives))}</span>
        </span>
      </div>

      <div className={`fall-field ${feedback || ''}`}>
        {round && (
          <div className="fall-word" style={{ top: `${pos}%` }}>
            {round.card.term}
          </div>
        )}
        <div className="fall-line" />
      </div>

      <div className="fall-options">
        {round?.options.map((opt) => (
          <button key={opt} className="fall-option" onClick={() => answer(opt)}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
