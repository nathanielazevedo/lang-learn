import { useEffect, useMemo, useRef, useState } from 'react'
import { speakThen, speechAvailable } from '../lib/speech.js'
import { playWordThen, stopAudio } from '../lib/audio.js'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const GAP_MS = 800 // brief pause after the answer before the next card
const MIN_DELAY = 2
const MAX_DELAY = 15

// Hands-free player: reads the front, gives you time to think, reads the back,
// then auto-advances. Built for passive listening with headphones.
export default function ListenView({ cards, label, sessionKey, direction, delay, onDelayChange, onExit }) {
  const pinyinFirst = direction === 'pinyin-first'
  const queue = useMemo(() => shuffle(cards), [sessionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('idle') // idle | front | think | back | done
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(true)

  const delayRef = useRef(delay)
  const loopRef = useRef(loop)
  useEffect(() => { delayRef.current = delay }, [delay])
  useEffect(() => { loopRef.current = loop }, [loop])

  // Drive the front -> think -> back -> next sequence for the current card.
  useEffect(() => {
    if (!playing) return
    const card = queue[index]
    if (!card) return

    let cancelled = false
    const timers = []
    const addTimer = (fn, ms) => {
      timers.push(setTimeout(() => !cancelled && fn(), ms))
    }

    // The Chinese side uses the generated pronunciation file (with TTS fallback);
    // the English side uses browser speech. Which is front depends on direction.
    const playChinese = (cb) => playWordThen(card, cb)
    const playEnglish = (cb) => speakThen(card.translation, 'en-US', cb)
    const playFront = pinyinFirst ? playChinese : playEnglish
    const playBack = pinyinFirst ? playEnglish : playChinese

    const goNext = () => {
      const next = index + 1
      if (next >= queue.length) {
        if (loopRef.current) setIndex(0)
        else {
          setPlaying(false)
          setPhase('done')
        }
      } else {
        setIndex(next)
      }
    }

    setPhase('front')
    playFront(() => {
      if (cancelled) return
      setPhase('think')
      addTimer(() => {
        setPhase('back')
        playBack(() => {
          if (cancelled) return
          addTimer(goNext, GAP_MS)
        })
      }, Math.max(0, delayRef.current) * 1000)
    })

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      stopAudio()
    }
  }, [index, playing, queue, pinyinFirst])

  // Stop any audio if we leave the screen.
  useEffect(() => () => stopAudio(), [])

  if (!speechAvailable()) {
    return (
      <div className="session done">
        <h2>Audio not supported</h2>
        <p className="muted">This browser has no speech synthesis, so Listen mode can’t play.</p>
        <button className="primary" onClick={onExit}>Back to dashboard</button>
      </div>
    )
  }

  const card = queue[index]
  const frontText = pinyinFirst ? card.term : card.translation
  const backText = pinyinFirst ? card.translation : card.term
  const frontCls = pinyinFirst ? 'term' : 'translation'
  const backCls = pinyinFirst ? 'translation' : 'term'
  const revealBack = phase === 'back' || phase === 'done'

  const statusText =
    phase === 'front' ? '🔊 Listen…'
    : phase === 'think' ? `🤔 Think… (${delay}s)`
    : phase === 'back' ? '🔊 Answer'
    : phase === 'done' ? '✅ Finished'
    : 'Ready'

  function start() {
    if (phase === 'done') setIndex(0)
    setPhase('front')
    setPlaying(true)
  }
  function pause() {
    setPlaying(false)
  }
  function changeDelay(d) {
    onDelayChange(Math.min(MAX_DELAY, Math.max(MIN_DELAY, d)))
  }

  return (
    <div className="session listen">
      <div className="session-top">
        <button className="ghost" onClick={onExit}>← Exit</button>
        <span className="muted">{index + 1} / {queue.length} · {label}</span>
      </div>

      <div className="listen-card">
        <span className="listen-status">{statusText}</span>
        <span className={frontCls}>{frontText}</span>
        <span className={`listen-back ${backCls} ${revealBack ? 'show' : ''}`}>
          {revealBack ? backText : '•••'}
        </span>
        {card.example && revealBack && <span className="example">“{card.example}”</span>}
      </div>

      <div className="listen-controls">
        {playing ? (
          <button className="primary wide" onClick={pause}>⏸ Pause</button>
        ) : (
          <button className="primary wide" onClick={start}>
            {phase === 'done' ? '↻ Replay' : '▶ Play'}
          </button>
        )}
      </div>

      <div className="listen-options">
        <div className="delay-control">
          <span className="muted small">Think time</span>
          <div className="stepper">
            <button onClick={() => changeDelay(delay - 1)} aria-label="Less time">−</button>
            <span className="delay-value">{delay}s</span>
            <button onClick={() => changeDelay(delay + 1)} aria-label="More time">+</button>
          </div>
        </div>
        <label className="loop-toggle">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          <span>Loop</span>
        </label>
      </div>
    </div>
  )
}
