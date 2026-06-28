import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx } from '../lib/sfx.js'
import { playWord } from '../lib/audio.js'
import { getAllHighScores, submitHighScore } from '../lib/highscore.js'
import SpeakButton from './SpeakButton.jsx'

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
const LEVEL_KEY = 'langlearn.falling.level'
const AUDIO_KEY = 'langlearn.falling.audio'

// Arcade mode: pinyin words fall from the top; tap the matching English before
// they hit the bottom. Higher levels include every word from earlier levels.
export default function FallingView({ levels, onExit, onStudyWrong }) {
  const maxLevel = levels[levels.length - 1].level
  const [selectedLevel, setSelectedLevel] = useState(() => {
    const saved = Number(localStorage.getItem(LEVEL_KEY) || 1)
    return Math.min(maxLevel, Math.max(1, saved))
  })

  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [running, setRunning] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [best, setBest] = useState(() => Number(localStorage.getItem('langlearn.falling.best') || 0))
  const [allScores, setAllScores] = useState(null) // [{ scope, score, name }] | null
  const [playedBest, setPlayedBest] = useState(null) // best for the game just played
  const [playedScope, setPlayedScope] = useState(null) // { mode, level } of the played game
  const [name, setName] = useState(() => localStorage.getItem('langlearn.falling.name') || '')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [round, setRound] = useState(null)
  const [pos, setPos] = useState(0)
  const [feedback, setFeedback] = useState(null) // 'correct' | 'wrong'
  const [pops, setPops] = useState([])
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1')
  const [wrongCards, setWrongCards] = useState([])
  // Audio mode: the word is hidden and you identify it by hearing it once.
  const [audioMode, setAudioMode] = useState(() => localStorage.getItem(AUDIO_KEY) === '1')

  const posRef = useRef(0)
  const scoreRef = useRef(0)
  const livesRef = useRef(START_LIVES)
  const streakRef = useRef(0)
  const wrongRef = useRef([])
  const poolRef = useRef([])
  const audioModeRef = useRef(false)
  const popId = useRef(0)
  const flashTimer = useRef(null)

  useEffect(() => { sfx.setEnabled(!muted) }, [muted])

  const currentMode = audioMode ? 'audio' : 'word'

  // Look up the record for a mode+level from the loaded leaderboard.
  const scoreFor = (mode, level) =>
    allScores?.find((r) => r.scope === `${mode}:L${level}`) || null
  // Best for the currently selected scope (null if scores couldn't load).
  const globalBest = allScores ? scoreFor(currentMode, selectedLevel) || { score: 0, name: '' } : null

  const loadScores = useCallback(() => {
    getAllHighScores().then(setAllScores)
  }, [])

  // Refresh the leaderboard whenever we're on the start/end screen.
  useEffect(() => {
    if (!running) loadScores()
  }, [running, loadScores])

  async function submitScore() {
    if (!playedScope) return
    setSubmitting(true)
    const clean = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 12)
    localStorage.setItem('langlearn.falling.name', clean)
    const hs = await submitHighScore(playedScope.mode, playedScope.level, score, clean)
    if (hs) {
      setPlayedBest(hs)
      loadScores() // refresh the leaderboard
    }
    setSubmitted(true)
    setSubmitting(false)
  }

  // Cumulative pool for a level: every word from level 1 up to it.
  function poolForLevel(level) {
    return levels.filter((l) => l.level <= level).flatMap((l) => l.cards)
  }

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
    const next = buildRound(poolRef.current)
    setRound(next)
    if (audioModeRef.current) playWord(next.card) // hear it once
  }

  function endGame() {
    setRunning(false)
    setGameOver(true)
    setRound(null)
    const seen = new Set()
    setWrongCards(wrongRef.current.filter((c) => !seen.has(c.id) && seen.add(c.id)))
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
    if (round?.card) wrongRef.current.push(round.card)
    streakRef.current = 0
    livesRef.current -= 1
    setLives(livesRef.current)
    if (livesRef.current <= 0) endGame()
    else spawn()
  }

  function selectLevel(level) {
    setSelectedLevel(level)
    localStorage.setItem(LEVEL_KEY, String(level))
  }

  function toggleAudioMode(v) {
    setAudioMode(v)
    localStorage.setItem(AUDIO_KEY, v ? '1' : '0')
  }

  function start() {
    poolRef.current = poolForLevel(selectedLevel)
    audioModeRef.current = audioMode
    // Snapshot which scope this game counts toward (the chooser can change after).
    setPlayedScope({ mode: audioMode ? 'audio' : 'word', level: selectedLevel })
    setPlayedBest(globalBest)
    scoreRef.current = 0
    livesRef.current = START_LIVES
    streakRef.current = 0
    wrongRef.current = []
    setWrongCards([])
    setScore(0)
    setLives(START_LIVES)
    setPops([])
    setSubmitted(false)
    setGameOver(false)
    setRunning(true)
    sfx.start()
    spawn()
  }

  function answer(option) {
    if (!round || !running) return
    if (option === round.card.translation) {
      const gained = Math.max(1, Math.ceil((100 - posRef.current) / 12))
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

  // --- Intro / game-over screen (also where you pick the level) ---
  if (!running) {
    return (
      <div className="session done">
        <h2>{gameOver ? 'Game over' : '🕹️ Falling Words'}</h2>

        {gameOver ? (
          <>
            <div className="score-ring">{score}</div>
            {playedScope && (
              <p className="scope-label">
                Level {playedScope.level} · {playedScope.mode === 'audio' ? '🔊 Audio mode' : 'Word mode'}
              </p>
            )}
            <p className="muted">
              Your best: {Math.max(best, score)}
              {playedBest && <> · 🌍 Global: {playedBest.score}{playedBest.name ? ` (${playedBest.name})` : ''}</>}
            </p>

            {playedBest && score > playedBest.score && !submitted && (
              <div className="record-entry">
                <span className="record-title">🏆 New global high score!</span>
                <div className="initials-row">
                  <input
                    className="name-input"
                    value={name}
                    maxLength={12}
                    placeholder="name (optional)"
                    onChange={(e) => setName(e.target.value)}
                    aria-label="Your name (optional)"
                  />
                  <button className="primary" disabled={submitting} onClick={submitScore}>
                    {submitting ? '…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
            {submitted && <p className="muted">Saved to the global leaderboard! 🌍</p>}
          </>
        ) : (
          <p className="muted">
            Tap the English meaning before each pinyin word hits the bottom.<br />
            Higher levels include all the words from earlier levels.
          </p>
        )}

        <div className="level-choose">
          {levels.map((l) => (
            <button
              key={l.id}
              className={`level-pick ${selectedLevel === l.level ? 'active' : ''}`}
              onClick={() => selectLevel(l.level)}
            >
              <span className="lp-num">Lvl {l.level}</span>
              <span className="lp-count">{l.level * 50} words</span>
            </button>
          ))}
        </div>

        <label className="audio-mode-toggle">
          <input
            type="checkbox"
            checked={audioMode}
            onChange={(e) => toggleAudioMode(e.target.checked)}
          />
          <span>🔊 Audio mode — word hidden, hear it once</span>
        </label>

        {!gameOver && allScores && allScores.length > 0 && (
          <div className="leaderboard">
            <h3>🏆 High scores</h3>
            <table className="lb-table">
              <thead>
                <tr><th></th><th>Word</th><th>🔊 Audio</th></tr>
              </thead>
              <tbody>
                {levels.map((l) => {
                  const w = scoreFor('word', l.level)
                  const a = scoreFor('audio', l.level)
                  const cell = (r) => (r ? <>{r.score}{r.name ? <span className="lb-name"> {r.name}</span> : ''}</> : '—')
                  return (
                    <tr key={l.id}>
                      <td className="lb-lvl">Lvl {l.level}</td>
                      <td>{cell(w)}</td>
                      <td>{cell(a)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {gameOver && wrongCards.length > 0 && (
          <div className="wrong-review">
            <h3>Words to review ({wrongCards.length})</h3>
            <div className="wrong-list">
              {wrongCards.map((c) => (
                <div className="wrong-item" key={c.id}>
                  <span className="w-term">{c.term}</span>
                  <span className="w-trans">{c.translation}</span>
                  <SpeakButton card={c} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="intro-actions">
          <button className="primary wide" onClick={start}>
            {gameOver ? `↻ Play Level ${selectedLevel}` : `▶ Start Level ${selectedLevel}`}
          </button>
          {gameOver && wrongCards.length > 0 && onStudyWrong && (
            <button className="wide" onClick={() => onStudyWrong(wrongCards)}>
              📚 Study these words
            </button>
          )}
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
          <div
            className={`fall-word ${wordState} ${audioMode ? 'audio' : ''}`}
            style={{ top: `${pos}%` }}
          >
            {audioMode ? '🔊' : round.card.term}
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
