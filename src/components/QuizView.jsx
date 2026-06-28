import { useMemo, useState } from 'react'
import SpeakButton from './SpeakButton.jsx'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Build multiple-choice questions. Direction decides which side is the prompt
// and which side you pick: pinyin-first => show pinyin, pick English; and vice versa.
function buildQuiz(pool, direction) {
  const pinyinFirst = direction === 'pinyin-first'
  const promptField = pinyinFirst ? 'term' : 'translation'
  const answerField = pinyinFirst ? 'translation' : 'term'

  const cards = shuffle(pool).slice(0, 10)
  return cards.map((card) => {
    const distractors = shuffle(pool.filter((c) => c.id !== card.id))
      .slice(0, 3)
      .map((c) => c[answerField])
    return {
      id: card.id,
      term: card.term,
      hanzi: card.hanzi,
      prompt: card[promptField],
      answer: card[answerField],
      options: shuffle([card[answerField], ...distractors]),
    }
  })
}

export default function QuizView({ cards, label, sessionKey, grade, onExit, direction }) {
  const quiz = useMemo(() => buildQuiz(cards, direction), [sessionKey, direction]) // eslint-disable-line react-hooks/exhaustive-deps

  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState(0)

  const q = quiz[index]
  const isLast = index === quiz.length - 1
  const promptLabel = direction === 'pinyin-first' ? 'What does this mean?' : 'How do you say this?'

  function pick(option) {
    if (picked) return
    setPicked(option)
    const correct = option === q.answer
    if (correct) setScore((s) => s + 1)
    grade(q.id, correct ? 2 : 0)
  }

  function next() {
    if (isLast) {
      setIndex(quiz.length) // move past the end -> results screen
    } else {
      setIndex((i) => i + 1)
      setPicked(null)
    }
  }

  if (index >= quiz.length) {
    const pct = Math.round((score / quiz.length) * 100)
    return (
      <div className="session done">
        <h2>Quiz complete</h2>
        <div className="score-ring">{pct}%</div>
        <p className="muted">{score} / {quiz.length} correct</p>
        <button className="primary" onClick={onExit}>Back to dashboard</button>
      </div>
    )
  }

  return (
    <div className="session">
      <div className="session-top">
        <button className="ghost" onClick={onExit}>← Exit</button>
        <span className="muted">{index + 1} / {quiz.length} · {label}</span>
      </div>

      <div className="quiz-prompt">
        <span className="muted small">{promptLabel}</span>
        <h2>
          {q.prompt}
          <SpeakButton card={q} />
        </h2>
      </div>

      <div className="options">
        {q.options.map((opt) => {
          let cls = 'option'
          if (picked) {
            if (opt === q.answer) cls += ' correct'
            else if (opt === picked) cls += ' wrong'
          }
          return (
            <button key={opt} className={cls} onClick={() => pick(opt)} disabled={!!picked}>
              {opt}
            </button>
          )
        })}
      </div>

      {picked && (
        <button className="primary wide" onClick={next}>
          {isLast ? 'See results' : 'Next →'}
        </button>
      )}
    </div>
  )
}
