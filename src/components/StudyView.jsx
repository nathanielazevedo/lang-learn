import { useMemo, useState } from 'react'
import { isDue } from '../lib/srs.js'
import Flashcard from './Flashcard.jsx'
import SpeakButton from './SpeakButton.jsx'

// `cards` is whatever the caller wants studied (a deck, or a filtered set).
// `prioritizeDue` puts due cards first (good for normal deck review); turn it
// off for filtered sessions where every card should be studied.
export default function StudyView({
  cards,
  label,
  sessionKey,
  progress,
  grade,
  onExit,
  direction,
  prioritizeDue = true,
}) {
  const initialQueue = useMemo(() => {
    let pool = cards
    if (prioritizeDue) {
      const due = cards.filter((c) => isDue(progress[c.id]))
      pool = due.length ? due : cards
    }
    return pool.slice(0, 30).map((c) => c.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey])

  const [queue, setQueue] = useState(initialQueue)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)

  if (queue.length === 0) {
    return (
      <div className="session done">
        <h2>Session complete 🎉</h2>
        <p className="muted">You reviewed {done} card{done === 1 ? '' : 's'}.</p>
        <button className="primary" onClick={onExit}>Back to dashboard</button>
      </div>
    )
  }

  const currentId = queue[0]
  const card = cards.find((c) => c.id === currentId)

  function handleGrade(q) {
    grade(currentId, q)
    setDone((d) => d + 1)
    setFlipped(false)
    setQueue((prev) => {
      const [, ...rest] = prev
      // "Again" cards come back later in the same session.
      return q === 0 ? [...rest, currentId] : rest
    })
  }

  return (
    <div className="session">
      <div className="session-top">
        <button className="ghost" onClick={onExit}>← Exit</button>
        <span className="muted">{queue.length} left · {label}</span>
      </div>

      <Flashcard
        card={card}
        flipped={flipped}
        direction={direction}
        onFlip={() => setFlipped((f) => !f)}
      />

      <div className="speak-row">
        <SpeakButton card={card} size="lg" />
        <span className="muted small">hear it</span>
      </div>

      {!flipped ? (
        <button className="primary wide" onClick={() => setFlipped(true)}>
          Show answer
        </button>
      ) : (
        <div className="grade-row">
          <button className="grade again" onClick={() => handleGrade(0)}>
            Forgot
          </button>
          <button className="grade good" onClick={() => handleGrade(2)}>
            Knew it
          </button>
        </div>
      )}
    </div>
  )
}
