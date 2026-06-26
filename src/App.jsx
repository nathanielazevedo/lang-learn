import { useMemo, useState } from 'react'
import { decks, allCards } from './data/decks.js'
import { useProgress } from './hooks/useProgress.js'
import { useSettings } from './hooks/useSettings.js'
import { isDue, masteryLevel } from './lib/srs.js'
import Dashboard from './components/Dashboard.jsx'
import StudyView from './components/StudyView.jsx'
import QuizView from './components/QuizView.jsx'
import TypingView from './components/TypingView.jsx'
import Settings from './components/Settings.jsx'

export default function App() {
  const { progress, grade, reset } = useProgress()
  const { settings, update } = useSettings()
  const [view, setView] = useState({ name: 'dashboard' })

  const stats = useMemo(() => {
    let mastered = 0
    let learning = 0
    let due = 0
    for (const card of allCards) {
      const p = progress[card.id]
      const level = masteryLevel(p)
      if (level === 'mastered') mastered++
      else if (level === 'learning' || level === 'seen') learning++
      if (isDue(p)) due++
    }
    return { total: allCards.length, mastered, learning, due }
  }, [progress])

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView({ name: 'dashboard' })}>
          <span className="brand-flag">🇨🇳</span>
          <span className="brand-name">LangLearn</span>
          <span className="brand-sub">Mandarin · Pinyin</span>
        </button>
        <nav>
          <button
            className={view.name === 'dashboard' ? 'active' : ''}
            onClick={() => setView({ name: 'dashboard' })}
          >
            🏠 <span className="nav-label">Dashboard</span>
          </button>
          <button
            className={view.name === 'settings' ? 'active' : ''}
            onClick={() => setView({ name: 'settings' })}
          >
            ⚙️ <span className="nav-label">Settings</span>
          </button>
        </nav>
      </header>

      <main className="container">
        {view.name === 'dashboard' && (
          <Dashboard
            decks={decks}
            progress={progress}
            stats={stats}
            onStudy={(deckId) => setView({ name: 'study', deckId })}
            onQuiz={(deckId) => setView({ name: 'quiz', deckId })}
            onType={(deckId) => setView({ name: 'typing', deckId })}
            onReset={reset}
          />
        )}

        {view.name === 'study' && (
          <StudyView
            deckId={view.deckId}
            progress={progress}
            grade={grade}
            direction={settings.direction}
            onExit={() => setView({ name: 'dashboard' })}
          />
        )}

        {view.name === 'quiz' && (
          <QuizView
            deckId={view.deckId}
            grade={grade}
            direction={settings.direction}
            onExit={() => setView({ name: 'dashboard' })}
          />
        )}

        {view.name === 'typing' && (
          <TypingView
            deckId={view.deckId}
            grade={grade}
            direction={settings.direction}
            onExit={() => setView({ name: 'dashboard' })}
          />
        )}

        {view.name === 'settings' && (
          <Settings
            settings={settings}
            update={update}
            onExit={() => setView({ name: 'dashboard' })}
          />
        )}
      </main>

      <footer className="footer">
        Built with React · progress saved locally in your browser
      </footer>
    </div>
  )
}
