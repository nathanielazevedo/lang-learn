import { useState } from 'react'
import { bucketOf, BUCKET_LABELS } from '../lib/srs.js'
import { regenerateAudio, playFresh } from '../lib/audio.js'
import SpeakButton from './SpeakButton.jsx'

const canRegen = import.meta.env.DEV // dev-server only

// A plain reference list of every word in a level.
export default function ListWords({ cards, label, progress, onExit }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  async function regen(card) {
    setBusyId(card.id)
    setError(null)
    try {
      await regenerateAudio(card)
      playFresh(card) // hear the new version
    } catch (e) {
      setError(`${card.term}: ${e.message}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="session listwords">
      <div className="session-top">
        <button className="ghost" onClick={onExit}>← Exit</button>
        <span className="muted">{label} · {cards.length} words</span>
      </div>

      {error && <div className="regen-error">⚠️ {error}</div>}

      <div className="word-list">
        {cards.map((card) => {
          const b = bucketOf(progress[card.id])
          return (
            <div className="word-row" key={card.id}>
              <span className={`mastery-dot ${b}`} title={BUCKET_LABELS[b]} />
              <span className="word-term">{card.term}</span>
              <span className="word-trans">{card.translation}</span>
              {canRegen && (
                <button
                  className="regen-btn"
                  onClick={() => regen(card)}
                  disabled={busyId === card.id}
                  title="Regenerate audio"
                  aria-label={`Regenerate audio for ${card.term}`}
                >
                  {busyId === card.id ? '…' : '♻️'}
                </button>
              )}
              <SpeakButton card={card} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
