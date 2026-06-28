import { isDue, masteryLevel, QUALITIES } from '../lib/srs.js'

function levelStats(level, progress) {
  let mastered = 0
  let due = 0
  for (const card of level.cards) {
    const p = progress[card.id]
    if (masteryLevel(p) === 'mastered') mastered++
    if (isDue(p)) due++
  }
  return { mastered, due, total: level.cards.length }
}

export default function Dashboard({ levels, progress, stats, ratingCounts, onStudy, onQuiz, onType, onReview, onListen, onListenAll, onFalling, onList, onReset }) {
  const hasRatings = QUALITIES.some((g) => ratingCounts[g.q] > 0)

  return (
    <div className="dashboard">
      <section className="hero">
        <h1>Your progress</h1>
        <div className="stat-grid">
          <Stat label="Words" value={stats.total} />
          <Stat label="Learning" value={stats.learning} tone="learning" />
          <Stat label="Mastered" value={stats.mastered} tone="mastered" />
          <Stat label="Due now" value={stats.due} tone="due" />
        </div>
        <div className="hero-modes">
          <button className="mode-btn listen-mode" onClick={onListenAll}>
            🎧 Listen — hands-free
          </button>
          <button className="mode-btn game-mode" onClick={onFalling}>
            🕹️ Falling Words — game
          </button>
        </div>
      </section>

      {hasRatings && (
        <section>
          <h2>Study by rating</h2>
          <p className="muted small">Drill the cards you last marked a certain way, across all levels.</p>
          <div className="rating-row">
            {QUALITIES.map((g) => {
              const count = ratingCounts[g.q]
              if (!count) return null
              return (
                <button
                  key={g.q}
                  className={`rating-chip ${g.cls}`}
                  onClick={() => onReview(g.q)}
                >
                  <span className="rating-label">{g.label}</span>
                  <span className="rating-count">{count}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <h2>Levels</h2>
        <div className="deck-grid">
          {levels.map((level) => {
            const s = levelStats(level, progress)
            const pct = Math.round((s.mastered / s.total) * 100)
            return (
              <article className="deck-card" key={level.id}>
                <div className="deck-head">
                  <span className="level-badge">{level.level}</span>
                  <div>
                    <h3>{level.name}</h3>
                    <p className="muted">{level.subtitle} · {s.due} due</p>
                  </div>
                </div>
                <div className="progress-bar" aria-label={`${pct}% mastered`}>
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="muted small">{pct}% mastered</p>
                <div className="deck-actions">
                  <button className="primary" onClick={() => onStudy(level.id)}>
                    Study
                  </button>
                  <button onClick={() => onQuiz(level.id)}>Quiz</button>
                  <button onClick={() => onType(level.id)}>Type</button>
                  <button onClick={() => onListen(level.id)}>🎧 Listen</button>
                  <button onClick={() => onList(level.id)}>📋 List</button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="danger-zone">
        <button className="link-danger" onClick={() => {
          if (confirm('Reset all progress? This cannot be undone.')) onReset()
        }}>
          Reset all progress
        </button>
      </section>
    </div>
  )
}

function Stat({ label, value, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
