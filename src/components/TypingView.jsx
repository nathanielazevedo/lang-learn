import { useRef, useState } from 'react'
import { checkAnswer } from '../lib/answer.js'
import SpeakButton from './SpeakButton.jsx'

export default function TypingView({ cards, label, sessionKey, grade, onExit, direction }) {
  const pinyinFirst = direction === 'pinyin-first'
  // Run the whole deck, in order, every time.
  const questions = cards

  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [result, setResult] = useState(null) // null | { correct }
  const [score, setScore] = useState(0)
  const inputRef = useRef(null)

  if (index >= questions.length) {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div className="session done">
        <h2>Typing complete</h2>
        <div className="score-ring">{pct}%</div>
        <p className="muted">{score} / {questions.length} correct</p>
        <button className="primary" onClick={onExit}>Back to dashboard</button>
      </div>
    )
  }

  const card = questions[index]
  const isLast = index === questions.length - 1
  const prompt = pinyinFirst ? card.term : card.translation
  const expected = pinyinFirst ? card.translation : card.term
  const promptLabel = pinyinFirst
    ? 'Type the English meaning'
    : 'Type the pīnyīn (tone marks optional)'

  function submit(e) {
    e.preventDefault()
    if (result) return
    const correct = checkAnswer(value, expected)
    setResult({ correct })
    if (correct) setScore((s) => s + 1)
    grade(card.id, correct ? 2 : 0)
  }

  function next() {
    if (isLast) {
      setIndex(questions.length)
      return
    }
    setIndex((i) => i + 1)
    setValue('')
    setResult(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  // One wrong answer sends you back to the very beginning of the run.
  function restart() {
    setIndex(0)
    setValue('')
    setResult(null)
    setScore(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const inputCls = result ? (result.correct ? 'correct' : 'wrong') : ''

  return (
    <div className="session">
      <div className="session-top">
        <button className="ghost" onClick={onExit}>← Exit</button>
        <span className="muted">{index + 1} / {questions.length} · {label}</span>
      </div>

      <div className="quiz-prompt">
        <span className="muted small">{promptLabel}</span>
        <h2>
          {prompt}
          {pinyinFirst && <SpeakButton card={card} />}
        </h2>
      </div>

      <form onSubmit={submit} className="type-form">
        <input
          ref={inputRef}
          className={`type-input ${inputCls}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type your answer…"
          disabled={!!result}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {!result && (
          <button className="primary wide" type="submit">Check</button>
        )}
      </form>

      {result && (
        <div className={`type-feedback ${result.correct ? 'correct' : 'wrong'}`}>
          {result.correct ? (
            <span>✓ Correct!</span>
          ) : (
            <span>
              ✗ Answer: <strong>{expected}</strong>
              {!pinyinFirst && <SpeakButton card={card} />}
            </span>
          )}
          <button className="primary wide" onClick={result.correct ? next : restart} autoFocus>
            {result.correct ? (isLast ? 'See results' : 'Next →') : '↺ Start over'}
          </button>
        </div>
      )}
    </div>
  )
}
