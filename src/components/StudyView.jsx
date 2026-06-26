import { useMemo, useState } from 'react'
import { getDeck } from '../data/decks.js'
import { isDue } from '../lib/srs.js'
import Flashcard from './Flashcard.jsx'
import SpeakButton from './SpeakButton.jsx'

const GRADES = [
  { q: 0, label: 'Again', cls: 'again' },
  { q: 1, label: 'Hard', cls: 'hard' },
  { q: 2, label: 'Good', cls: 'good' },
  { q: 3, label: 'Easy', cls: 'easy' },
]

export default function StudyView({ deckId, progress, grade, onExit, direction }) {
  const deck = getDeck(deckId)

  // Build the initial queue once: due cards first, capped to a focused session.
  const initialQueue = useMemo(() => {
    const due = deck.cards.filter((c) => isDue(progress[c.id]))
    const pool = due.length ? due : deck.cards
    return pool.slice(0, 20).map((c) => c.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId])

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
  const card = deck.cards.find((c) => c.id === currentId)

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
        <span className="muted">{queue.length} left · {deck.flag} {deck.language}</span>
      </div>

      <Flashcard
        card={card}
        flipped={flipped}
        direction={direction}
        onFlip={() => setFlipped((f) => !f)}
      />

      <div className="speak-row">
        <SpeakButton text={card.hanzi || card.term} label={card.term} size="lg" />
        <span className="muted small">hear it</span>
      </div>

      {!flipped ? (
        <button className="primary wide" onClick={() => setFlipped(true)}>
          Show answer
        </button>
      ) : (
        <div className="grade-row">
          {GRADES.map((g) => (
            <button key={g.q} className={`grade ${g.cls}`} onClick={() => handleGrade(g.q)}>
              {g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
