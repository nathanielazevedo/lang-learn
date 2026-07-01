import { useEffect, useRef, useState } from 'react'
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
  const advanceTimer = useRef(null)

  // Keep the input focused on each new question (and on first mount).
  useEffect(() => {
    inputRef.current?.focus()
  }, [index])
  useEffect(() => () => clearTimeout(advanceTimer.current), [])

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
  const prompt = pinyinFirst ? card.pinyin : card.english
  const expected = pinyinFirst ? card.english : card.pinyin
  const promptLabel = pinyinFirst
    ? 'Type the English meaning'
    : 'Type the pīnyīn (tone marks optional)'

  // Flash the success state, then move on by itself.
  function markCorrect() {
    setResult({ correct: true })
    setScore((s) => s + 1)
    grade(card.id, 2)
    advanceTimer.current = setTimeout(next, 600)
  }

  // Detect a correct answer as the user types — no need to hit Enter.
  function handleChange(e) {
    const v = e.target.value
    setValue(v)
    if (result) return
    if (checkAnswer(v, expected)) markCorrect()
  }

  // Enter / Check: lets you submit a guess you think is right (or give up).
  function submit(e) {
    e.preventDefault()
    if (result) return
    if (checkAnswer(value, expected)) {
      markCorrect()
    } else {
      setResult({ correct: false })
      grade(card.id, 0)
    }
  }

  function next() {
    if (isLast) {
      setIndex(questions.length)
      return
    }
    setIndex((i) => i + 1)
    setValue('')
    setResult(null)
  }

  // One wrong answer sends you back to the very beginning of the run.
  function restart() {
    setIndex(0)
    setValue('')
    setResult(null)
    setScore(0)
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
          onChange={handleChange}
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
            <>
              <span>
                ✗ Answer: <strong>{expected}</strong>
                {!pinyinFirst && <SpeakButton card={card} />}
              </span>
              <button className="primary wide" onClick={restart} autoFocus>
                ↺ Start over
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
