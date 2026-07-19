import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx } from '../lib/sfx.js'
import { speak } from '../lib/speech.js'
import { cardsUpToLevel } from '../data/levels.js'
import { sentencesUpToLevel } from '../data/sentences.js'
import { getHighScore, submitHighScore } from '../lib/highscore.js'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Seconds allowed for one sentence: longer sentences get more time, and the whole
// budget tightens as the score climbs.
function timeLimit(score, tokenCount) {
  const base = 2.5 + tokenCount * 1.2
  return Math.max(2.5, base * Math.max(0.4, 1 - score * 0.006))
}

function buildRound(sentence, pool, byId) {
  const real = sentence.tokens.map((hanzi, i) => ({
    key: `t${i}`,
    hanzi,
    id: sentence.tokenIds[i],
    pinyin: byId.get(sentence.tokenIds[i])?.pinyin || '',
  }))
  const used = new Set(sentence.tokens)
  const distractors = shuffle(pool.filter((c) => !used.has(c.hanzi)))
    .slice(0, Math.min(3, Math.max(2, Math.round(sentence.tokens.length / 3))))
    .map((c, i) => ({ key: `d${i}`, hanzi: c.hanzi, id: c.id, pinyin: c.pinyin }))
  return { sentence, tiles: shuffle([...real, ...distractors]) }
}

const START_LIVES = 3
const MUTE_KEY = 'langlearn.falling.muted' // shared with Falling Words — one preference
const NAME_KEY = 'langlearn.falling.name'
const LEVEL_KEY = 'langlearn.rush.level'
const SCORES_KEY = 'langlearn.rush.scores'

// Arcade sentence building: assemble each sentence from its tiles before the timer
// runs out. The pool is cumulative, so level N includes every earlier sentence.
export default function SentenceRushView({ levels, onExit }) {
  const maxLevel = levels[levels.length - 1].level
  const [selectedLevel, setSelectedLevel] = useState(() => {
    const saved = Number(localStorage.getItem(LEVEL_KEY) || 1)
    return Math.min(maxLevel, Math.max(1, saved))
  })

  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [running, setRunning] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [round, setRound] = useState(null)
  const [placed, setPlaced] = useState([])
  const [remaining, setRemaining] = useState(0)
  const [reveal, setReveal] = useState(null) // the sentence you just missed
  const [feedback, setFeedback] = useState(null) // 'correct' | 'wrong'
  const [missed, setMissed] = useState([])
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1')
  const [myScores, setMyScores] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SCORES_KEY) || '{}')
    } catch {
      return {}
    }
  })
  const [globalBest, setGlobalBest] = useState(null)
  const [playedLevel, setPlayedLevel] = useState(null)
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const scoreRef = useRef(0)
  const livesRef = useRef(START_LIVES)
  const streakRef = useRef(0)
  const limitRef = useRef(0)
  const remainingRef = useRef(0)
  const roundRef = useRef(null)
  const deckRef = useRef([])
  const poolRef = useRef([])
  const byIdRef = useRef(new Map())
  const missedRef = useRef([])
  const playedLevelRef = useRef(null)
  const flashTimer = useRef(null)
  const gapTimer = useRef(null)

  useEffect(() => { sfx.setEnabled(!muted) }, [muted])
  useEffect(() => () => {
    clearTimeout(flashTimer.current)
    clearTimeout(gapTimer.current)
  }, [])

  const myBestFor = (level) => myScores[`build:L${level}`] || 0

  const loadBest = useCallback((level) => {
    getHighScore('build', level).then(setGlobalBest)
  }, [])

  useEffect(() => {
    if (!running) loadBest(selectedLevel)
  }, [running, selectedLevel, loadBest])

  const sentenceCount = sentencesUpToLevel(selectedLevel).length

  function selectLevel(level) {
    setSelectedLevel(level)
    localStorage.setItem(LEVEL_KEY, String(level))
  }

  function flash(kind) {
    setFeedback(kind)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFeedback(null), 240)
  }

  function nextSentence() {
    // Reshuffle rather than repeat once the deck is exhausted.
    if (!deckRef.current.length) deckRef.current = shuffle(sentencesUpToLevel(playedLevelRef.current))
    const sentence = deckRef.current.pop()
    const next = buildRound(sentence, poolRef.current, byIdRef.current)
    roundRef.current = next
    setRound(next)
    setPlaced([])
    setReveal(null)
    limitRef.current = timeLimit(scoreRef.current, sentence.tokens.length)
    remainingRef.current = limitRef.current
    setRemaining(limitRef.current)
  }

  function endGame() {
    clearTimeout(gapTimer.current)
    setRunning(false)
    setGameOver(true)
    setRound(null)
    roundRef.current = null
    const seen = new Set()
    setMissed(missedRef.current.filter((s) => !seen.has(s.id) && seen.add(s.id)))
    sfx.gameOver()
    const level = playedLevelRef.current
    if (level) {
      setMyScores((prev) => {
        const key = `build:L${level}`
        if (scoreRef.current <= (prev[key] || 0)) return prev
        const next = { ...prev, [key]: scoreRef.current }
        localStorage.setItem(SCORES_KEY, JSON.stringify(next))
        return next
      })
    }
  }

  // Show the answer for a beat before moving on, so a miss still teaches.
  function loseLife(sentence) {
    flash('wrong')
    sfx.wrong()
    streakRef.current = 0
    if (sentence) {
      missedRef.current.push(sentence)
      setReveal(sentence)
    }
    livesRef.current -= 1
    setLives(livesRef.current)
    roundRef.current = null
    remainingRef.current = 0
    setRemaining(0)
    if (livesRef.current <= 0) {
      gapTimer.current = setTimeout(endGame, 1400)
    } else {
      gapTimer.current = setTimeout(nextSentence, 1400)
    }
  }

  function start() {
    const level = selectedLevel
    playedLevelRef.current = level
    setPlayedLevel(level)
    poolRef.current = cardsUpToLevel(level)
    byIdRef.current = new Map(poolRef.current.map((c) => [c.id, c]))
    deckRef.current = shuffle(sentencesUpToLevel(level))
    scoreRef.current = 0
    livesRef.current = START_LIVES
    streakRef.current = 0
    missedRef.current = []
    setMissed([])
    setScore(0)
    setLives(START_LIVES)
    setSubmitted(false)
    setGameOver(false)
    setRunning(true)
    sfx.start()
    nextSentence()
  }

  function place(tile) {
    if (!roundRef.current || reveal) return
    const sentence = roundRef.current.sentence
    const next = [...placed, tile]
    setPlaced(next)

    // Auto-submit only on a correct arrangement, so there is no Check button to
    // burn the clock on but a mis-tap costs nothing either — you just pull the
    // tile back and keep going. Only the timer can take a life.
    // Compared as joined strings rather than by length, so an arrangement that
    // spells the sentence with a different tile split still counts.
    if (next.map((t) => t.hanzi).join('') === sentence.tokens.join('')) {
      const gained = Math.max(1, Math.ceil((remainingRef.current / limitRef.current) * 12))
      scoreRef.current += gained
      setScore(scoreRef.current)
      streakRef.current += 1
      sfx.correct(streakRef.current)
      flash('correct')
      speak(sentence.hanzi, 'zh-CN')
      roundRef.current = null
      gapTimer.current = setTimeout(nextSentence, 650)
      return
    }

    // Full but wrong: nudge without penalising, otherwise nothing happens when
    // the last tile goes down and the game feels broken.
    if (next.length >= sentence.tokens.length) flash('nudge')
  }

  function unplace(tile) {
    if (!roundRef.current || reveal) return
    setPlaced((p) => p.filter((t) => t.key !== tile.key))
  }

  async function submitScore() {
    if (!playedLevel) return
    setSubmitting(true)
    const clean = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 12)
    localStorage.setItem(NAME_KEY, clean)
    const hs = await submitHighScore('build', playedLevel, score, clean)
    if (hs) setGlobalBest(hs)
    setSubmitted(true)
    setSubmitting(false)
  }

  // The countdown. Runs only while a round is live, so the reveal pause is free.
  useEffect(() => {
    if (!running || !round || !roundRef.current) return
    let raf
    let last = performance.now()
    const tick = (now) => {
      // The round is cleared the moment it is answered, but this loop outlives it
      // by the length of the pause before the next sentence. Without this guard a
      // correct answer given in the last fraction of a second would let the clock
      // run out during that pause and cost a life already earned.
      if (!roundRef.current) return
      const dt = (now - last) / 1000
      last = now
      remainingRef.current -= dt
      if (remainingRef.current <= 0) {
        setRemaining(0)
        loseLife(roundRef.current?.sentence)
        return
      }
      setRemaining(remainingRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, round])

  // --- Game over ---
  if (gameOver) {
    const best = Math.max(myBestFor(playedLevel), score)
    return (
      <div className="session done">
        <h2>Game over</h2>
        <div className="score-ring">{score}</div>
        <p className="scope-label">Level {playedLevel} · Sentence Rush</p>
        <p className="muted">
          Your best: {best}
          {globalBest && <> · Global: {globalBest.score}{globalBest.name ? ` (${globalBest.name})` : ''}</>}
        </p>

        {globalBest && score > globalBest.score && !submitted && (
          <div className="record-entry">
            <span className="record-title">New global high score!</span>
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
        {submitted && <p className="muted">Saved to the global leaderboard!</p>}

        {missed.length > 0 && (
          <div className="wrong-review">
            <h3>Sentences to review ({missed.length})</h3>
            <div className="wrong-list">
              {missed.map((s) => (
                <div className="wrong-item rush-missed" key={s.id}>
                  <span className="w-term">{s.hanzi}</span>
                  <span className="w-trans">{s.english}</span>
                  <button
                    type="button"
                    className="speak-btn"
                    onClick={() => speak(s.hanzi, 'zh-CN')}
                    aria-label={`Play ${s.pinyin}`}
                    title="Play sentence"
                  >
                    🔊
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="intro-actions">
          <button className="primary wide" onClick={start}>↻ Play Level {playedLevel}</button>
          <button className="wide" onClick={onExit}>Back to dashboard</button>
        </div>
      </div>
    )
  }

  // --- Intro ---
  if (!running) {
    return (
      <div className="session done">
        <h2>Sentence Rush</h2>
        <p className="muted">
          Tap the tiles into the right order before the timer runs out.<br />
          Extra tiles are thrown in. Wrong guesses cost nothing — only the clock does.
        </p>

        <div className="game-setup">
          <div className="setup-group">
            <div className="setup-head">
              <span className="setup-label">Level</span>
              <span className="setup-meta">
                {sentenceCount} sentences{selectedLevel > 1 ? ' · cumulative' : ''}
              </span>
            </div>
            <div className="level-choose">
              {levels.map((l) => (
                <button
                  key={l.id}
                  className={`level-pick ${selectedLevel === l.level ? 'active' : ''}`}
                  onClick={() => selectLevel(l.level)}
                >
                  {l.level}
                </button>
              ))}
            </div>
            <span className="setup-hint">{levels.find((l) => l.level === selectedLevel)?.subtitle}</span>
          </div>
        </div>

        <div className="scores">
          <p className="best-line">
            <span>Your best <b>{myBestFor(selectedLevel)}</b></span>
            {globalBest && (
              <span>Global <b>{globalBest.score}</b>{globalBest.name ? ` (${globalBest.name})` : ''}</span>
            )}
          </p>
        </div>

        <div className="intro-actions">
          <button className="primary wide" onClick={start} disabled={!sentenceCount}>
            ▶ Start Level {selectedLevel}
          </button>
          <button className="wide" onClick={onExit}>Back to dashboard</button>
        </div>
      </div>
    )
  }

  // --- Active game ---
  const sentence = round?.sentence
  const pct = limitRef.current ? Math.max(0, (remaining / limitRef.current) * 100) : 0
  const timerState = pct < 25 ? 'danger' : pct < 50 ? 'warn' : ''
  const placedKeys = new Set(placed.map((t) => t.key))

  return (
    <div className={`session rush ${feedback || ''}`}>
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

      <div className="rush-timer" aria-label={`${remaining.toFixed(1)} seconds left`}>
        <div className={`rush-timer-fill ${timerState}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="quiz-prompt">
        <span className="muted small">Build this sentence</span>
        <h2>{sentence?.english}</h2>
      </div>

      {reveal ? (
        <div className="type-feedback wrong rush-reveal">
          <span>
            ✗ <strong>{reveal.hanzi}</strong>
            <br />
            {reveal.pinyin}
          </span>
        </div>
      ) : (
        <>
          <div className="tile-slots">
            {placed.map((tile) => (
              <button key={tile.key} className="tile" onClick={() => unplace(tile)}>
                {tile.hanzi}
                <span className="tile-pinyin">{tile.pinyin}</span>
              </button>
            ))}
          </div>

          <div className="tile-bank">
            {round?.tiles.map((tile) => (
              <button
                key={tile.key}
                className={`tile${placedKeys.has(tile.key) ? ' ghosted' : ''}`}
                onClick={() => place(tile)}
                disabled={placedKeys.has(tile.key)}
                aria-hidden={placedKeys.has(tile.key)}
              >
                {tile.hanzi}
                <span className="tile-pinyin">{tile.pinyin}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
