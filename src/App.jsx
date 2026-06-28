import { useMemo, useState } from 'react'
import { levels, allCards, getLevel } from './data/levels.js'
import { useProgress } from './hooks/useProgress.js'
import { useSettings } from './hooks/useSettings.js'
import { isDue, masteryLevel, QUALITIES } from './lib/srs.js'
import Dashboard from './components/Dashboard.jsx'
import StudyView from './components/StudyView.jsx'
import QuizView from './components/QuizView.jsx'
import TypingView from './components/TypingView.jsx'
import ListenView from './components/ListenView.jsx'
import ListWords from './components/ListWords.jsx'
import FallingView from './components/FallingView.jsx'
import Settings from './components/Settings.jsx'

export default function App() {
  const { progress, grade, reset } = useProgress()
  const { settings, update } = useSettings()
  const [view, setView] = useState({ name: 'dashboard' })
  const immersive = view.name === 'falling' // full-screen, no footer/scroll

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

  // How many cards were last rated Again / Hard / Good / Easy, for filtered review.
  const ratingCounts = useMemo(() => {
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0 }
    for (const card of allCards) {
      const q = progress[card.id]?.lastQuality
      if (q != null) counts[q] += 1
    }
    return counts
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

      <main className={`container${immersive ? ' immersive' : ''}`}>
        {view.name === 'dashboard' && (
          <Dashboard
            levels={levels}
            progress={progress}
            stats={stats}
            ratingCounts={ratingCounts}
            onStudy={(levelId) => setView({ name: 'study', levelId })}
            onQuiz={(levelId) => setView({ name: 'quiz', levelId })}
            onType={(levelId) => setView({ name: 'typing', levelId })}
            onReview={(quality) => setView({ name: 'review', quality })}
            onListen={(levelId) => setView({ name: 'listen', levelId })}
            onListenAll={() => setView({ name: 'listen', all: true })}
            onFalling={() => setView({ name: 'falling' })}
            onList={(levelId) => setView({ name: 'list', levelId })}
            onReset={reset}
          />
        )}

        {view.name === 'study' && (
          <StudyView
            cards={getLevel(view.levelId).cards}
            label={getLevel(view.levelId).name}
            sessionKey={view.levelId}
            progress={progress}
            grade={grade}
            direction={settings.direction}
            onExit={() => setView({ name: 'dashboard' })}
          />
        )}

        {view.name === 'review' && (
          <StudyView
            cards={allCards.filter((c) => progress[c.id]?.lastQuality === view.quality)}
            label={`${QUALITIES[view.quality].label} cards`}
            sessionKey={`review-${view.quality}`}
            progress={progress}
            grade={grade}
            direction={settings.direction}
            prioritizeDue={false}
            onExit={() => setView({ name: 'dashboard' })}
          />
        )}

        {view.name === 'quiz' && (
          <QuizView
            cards={getLevel(view.levelId).cards}
            label={getLevel(view.levelId).name}
            sessionKey={view.levelId}
            grade={grade}
            direction={settings.direction}
            onExit={() => setView({ name: 'dashboard' })}
          />
        )}

        {view.name === 'typing' && (
          <TypingView
            cards={getLevel(view.levelId).cards}
            label={getLevel(view.levelId).name}
            sessionKey={view.levelId}
            grade={grade}
            direction={settings.direction}
            onExit={() => setView({ name: 'dashboard' })}
          />
        )}

        {view.name === 'listen' && (
          <ListenView
            cards={view.all ? allCards : getLevel(view.levelId).cards}
            label={view.all ? '🎧 All words' : getLevel(view.levelId).name}
            sessionKey={view.all ? 'listen-all' : `listen-${view.levelId}`}
            direction={settings.direction}
            delay={settings.listenDelay}
            onDelayChange={(d) => update({ listenDelay: d })}
            onExit={() => setView({ name: 'dashboard' })}
          />
        )}

        {view.name === 'falling' && (
          <FallingView
            levels={levels}
            onExit={() => setView({ name: 'dashboard' })}
            onStudyWrong={(cards) => setView({ name: 'studywrong', cards })}
          />
        )}

        {view.name === 'studywrong' && (
          <StudyView
            cards={view.cards}
            label="🕹️ Missed words"
            sessionKey="studywrong"
            progress={progress}
            grade={grade}
            direction={settings.direction}
            prioritizeDue={false}
            onExit={() => setView({ name: 'dashboard' })}
          />
        )}

        {view.name === 'list' && (
          <ListWords
            cards={getLevel(view.levelId).cards}
            label={getLevel(view.levelId).name}
            progress={progress}
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

      {!immersive && (
        <footer className="footer">
          Built with React · progress saved locally in your browser
        </footer>
      )}
    </div>
  )
}
