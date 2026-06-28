import { useEffect, useRef, useState } from 'react'
import { sfx } from '../lib/sfx.js'

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
  return Math.max(2.6, 7 - score * 0.1)
}

const START_LIVES = 3
const MUTE_KEY = 'langlearn.falling.muted'

// Arcade mode: pinyin words fall from the top; tap the matching English before
// they hit the bottom. Wrong tap or a missed word costs a life.
export default function FallingView({ cards, onExit }) {
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [running, setRunning] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [best, setBest] = useState(() => Number(localStorage.getItem('langlearn.falling.best') || 0))
  const [round, setRound] = useState(null)
  const [pos, setPos] = useState(0)
  const [feedback, setFeedback] = useState(null) // 'correct' | 'wrong'
  const [pops, setPops] = useState([]) // floating "+N" labels
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1')

  const posRef = useRef(0)
  const scoreRef = useRef(0)
  const livesRef = useRef(START_LIVES)
  const streakRef = useRef(0) // internal only: rises the correct-sound pitch
  const popId = useRef(0)
  const flashTimer = useRef(null)

  useEffect(() => { sfx.setEnabled(!muted) }, [muted])

  function flash(kind) {
    setFeedback(kind)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFeedback(null), 240)
  }

  function addPop(text, top, kind) {
    const id = ++popId.current
    setPops((p) => [...p, { id, text, top: Math.min(88, top), kind }])
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 750)
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
    sfx.gameOver()
    setBest((b) => {
      const nb = Math.max(b, scoreRef.current)
      localStorage.setItem('langlearn.falling.best', String(nb))
      return nb
    })
  }

  function loseLife() {
    flash('wrong')
    sfx.wrong()
    streakRef.current = 0
    livesRef.current -= 1
    setLives(livesRef.current)
    if (livesRef.current <= 0) endGame()
    else spawn()
  }

  function start() {
    scoreRef.current = 0
    livesRef.current = START_LIVES
    streakRef.current = 0
    setScore(0)
    setLives(START_LIVES)
    setPops([])
    setGameOver(false)
    setRunning(true)
    sfx.start()
    spawn()
  }

  function answer(option) {
    if (!round || !running) return
    if (option === round.card.translation) {
      const gained = Math.max(1, Math.ceil((100 - posRef.current) / 12)) // catch higher = more
      scoreRef.current += gained
      setScore(scoreRef.current)
      addPop(`+${gained}`, posRef.current, 'good')
      streakRef.current += 1
      sfx.correct(streakRef.current)
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
        loseLife()
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
            <p className="muted">{score >= best && score > 0 ? '🏆 New best!' : `Best: ${best}`}</p>
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
  const wordState = pos > 78 ? 'danger' : pos > 55 ? 'warn' : ''

  return (
    <div className="session falling">
      <div className="session-top">
        <button className="ghost" onClick={onExit}>← Exit</button>
        <span className="hud">
          <span className="hud-score">⭐ {score}</span>
          <span className="hud-lives">{'❤️'.repeat(lives)}{'🤍'.repeat(START_LIVES - lives)}</span>
          <button
            className="ghost mute-btn"
            onClick={() => {
              const next = !muted
              setMuted(next)
              localStorage.setItem(MUTE_KEY, next ? '1' : '0')
            }}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </span>
      </div>

      <div className={`fall-field ${feedback || ''}`}>
        {round && (
          <div className={`fall-word ${wordState}`} style={{ top: `${pos}%` }}>
            {round.card.term}
          </div>
        )}
        {pops.map((p) => (
          <div key={p.id} className={`point-pop ${p.kind}`} style={{ top: `${p.top}%` }}>
            {p.text}
          </div>
        ))}
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
