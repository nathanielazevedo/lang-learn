export default function Settings({ settings, update, onExit }) {
  const dir = settings.direction

  return (
    <div className="settings">
      <div className="session-top">
        <button className="ghost" onClick={onExit}>← Back</button>
      </div>

      <h1>Settings</h1>

      <section className="setting-block">
        <h2>Study direction</h2>
        <p className="muted">Which side of the card do you want to see first, in flashcards and quizzes?</p>
        <div className="choice-row">
          <button
            className={`choice ${dir === 'pinyin-first' ? 'active' : ''}`}
            onClick={() => update({ direction: 'pinyin-first' })}
          >
            <span className="choice-title">Pīnyīn first</span>
            <span className="muted small">See pīnyīn → recall the English meaning</span>
          </button>
          <button
            className={`choice ${dir === 'english-first' ? 'active' : ''}`}
            onClick={() => update({ direction: 'english-first' })}
          >
            <span className="choice-title">English first</span>
            <span className="muted small">See English → recall the pīnyīn</span>
          </button>
        </div>
      </section>
    </div>
  )
}
