import { useMemo, useState } from 'react'
import { levels, allCards, getLevel, cardsUpToLevel } from './data/levels.js'
import { sentencesForLevel } from './data/sentences.js'
import { useProgress } from './hooks/useProgress.js'
import { useSentenceProgress } from './hooks/useSentenceProgress.js'
import { useSettings } from './hooks/useSettings.js'
import { bucketOf, BUCKET_LABELS } from './lib/srs.js'
import Dashboard from './components/Dashboard.jsx'
import StudyView from './components/StudyView.jsx'
import QuizView from './components/QuizView.jsx'
import TypingView from './components/TypingView.jsx'
import SentenceView from './components/SentenceView.jsx'
import ListenView from './components/ListenView.jsx'
import ListWords from './components/ListWords.jsx'
import FallingView from './components/FallingView.jsx'
import SentenceRushView from './components/SentenceRushView.jsx'
import Settings from './components/Settings.jsx'

export default function App() {
  const { progress, grade, reset } = useProgress()
  const { gradeSentence } = useSentenceProgress()
  const { settings, update } = useSettings()
  const [view, setView] = useState({ name: 'dashboard' })
  const immersive = view.name === 'falling' // full-screen, no footer/scroll

  const stats = useMemo(() => {
    const counts = { mastered: 0, forgot: 0, unseen: 0 }
    for (const card of allCards) counts[bucketOf(progress[card.id])]++
    return counts
  }, [progress])

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView({ name: 'dashboard' })}>
          <span className="brand-seal" aria-hidden="true">汉</span>
          <span className="brand-name">LangLearn</span>
          <span className="brand-sub">汉语 · Mandarin Pinyin</span>
        </button>
        <nav>
          <button
            className={view.name === 'dashboard' ? 'active' : ''}
            onClick={() => setView({ name: 'dashboard' })}
          >
            Dashboard
          </button>
          <button
            className={view.name === 'settings' ? 'active' : ''}
            onClick={() => setView({ name: 'settings' })}
          >
            Settings
          </button>
        </nav>
      </header>

      <main className={`container${immersive ? ' immersive' : ''}`}>
        {view.name === 'dashboard' && (
          <Dashboard
            levels={levels}
            progress={progress}
            stats={stats}
            onStudy={(levelId) => setView({ name: 'study', levelId })}
            onQuiz={(levelId) => setView({ name: 'quiz', levelId })}
            onType={(levelId) => setView({ name: 'typing', levelId })}
            onBuild={(levelId) => setView({ name: 'sentence', levelId })}
            onStudyBucket={(bucket) => setView({ name: 'studyset', bucket })}
            onListen={(levelId) => setView({ name: 'listen', levelId })}
            onFalling={() => setView({ name: 'falling' })}
            onRush={() => setView({ name: 'rush' })}
            onList={(levelId) => setView({ name: 'list', levelId })}
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

        {view.name === 'studyset' && (
          <StudyView
            cards={allCards.filter((c) => bucketOf(progress[c.id]) === view.bucket)}
            label={`${BUCKET_LABELS[view.bucket]} words`}
            sessionKey={`bucket-${view.bucket}`}
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

        {view.name === 'sentence' && (
          <SentenceView
            sentences={sentencesForLevel(getLevel(view.levelId).level)}
            pool={cardsUpToLevel(getLevel(view.levelId).level)}
            label={getLevel(view.levelId).name}
            sessionKey={view.levelId}
            gradeSentence={gradeSentence}
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
            grade={grade}
            onExit={() => setView({ name: 'dashboard' })}
            onStudyWrong={(cards) => setView({ name: 'studywrong', cards })}
          />
        )}

        {view.name === 'rush' && (
          <SentenceRushView levels={levels} onExit={() => setView({ name: 'dashboard' })} />
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
            sentences={sentencesForLevel(getLevel(view.levelId).level)}
            progress={progress}
            onExit={() => setView({ name: 'dashboard' })}
          />
        )}

        {view.name === 'settings' && (
          <Settings
            settings={settings}
            update={update}
            onReset={reset}
            onExit={() => setView({ name: 'dashboard' })}
          />
        )}
      </main>
    </div>
  )
}
