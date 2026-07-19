import { useEffect, useMemo, useRef, useState } from 'react'
import { playWord } from '../lib/audio.js'
import { speak } from '../lib/speech.js'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Tiles carry a unique `key` rather than being identified by their hanzi: a
// sentence can legitimately repeat a word (我…我, 不…不), and keying on the
// character would make the two copies indistinguishable.
function buildRound(sentence, pool, levelSentences, byId) {
  const real = sentence.tokens.map((hanzi, i) => ({
    key: `t${i}`,
    hanzi,
    id: sentence.tokenIds[i],
    pinyin: byId.get(sentence.tokenIds[i])?.pinyin || '',
  }))

  const used = new Set(sentence.tokens)
  // Prefer distractors that appear in *other* sentences of this level. They are
  // grammatically plausible here, so rejecting them takes actual thought —
  // a random noun from a 300-word pool is dismissed on sight.
  const plausible = new Set(levelSentences.flatMap((s) => s.tokens))
  const candidates = pool.filter((c) => !used.has(c.hanzi))
  const ranked = [
    ...shuffle(candidates.filter((c) => plausible.has(c.hanzi))),
    ...shuffle(candidates.filter((c) => !plausible.has(c.hanzi))),
  ]
  const count = Math.min(3, Math.max(2, Math.round(sentence.tokens.length / 3)))
  const distractors = ranked.slice(0, count).map((c, i) => ({
    key: `d${i}`,
    hanzi: c.hanzi,
    id: c.id,
    pinyin: c.pinyin,
  }))

  return { sentence, tiles: shuffle([...real, ...distractors]) }
}

export default function SentenceView({ sentences, pool, label, sessionKey, gradeSentence, onExit }) {
  const byId = useMemo(() => new Map(pool.map((c) => [c.id, c])), [pool])
  const rounds = useMemo(
    () => shuffle(sentences).slice(0, 10).map((s) => buildRound(s, pool, sentences, byId)),
    [sessionKey] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const [index, setIndex] = useState(0)
  const [placed, setPlaced] = useState([])
  const [result, setResult] = useState(null) // null | { correct }
  const [score, setScore] = useState(0)
  const advanceTimer = useRef(null)

  useEffect(() => () => clearTimeout(advanceTimer.current), [])

  if (index >= rounds.length) {
    const pct = Math.round((score / rounds.length) * 100)
    return (
      <div className="session done">
        <h2>Sentences complete</h2>
        <div className="score-ring">{pct}%</div>
        <p className="muted">{score} / {rounds.length} correct</p>
        <button className="primary" onClick={onExit}>Back to dashboard</button>
      </div>
    )
  }

  const { sentence, tiles } = rounds[index]
  const isLast = index === rounds.length - 1
  const placedKeys = new Set(placed.map((t) => t.key))

  function place(tile) {
    if (result) return
    playWord(tile)
    setPlaced((p) => [...p, tile])
  }

  function unplace(tile) {
    if (result) return
    setPlaced((p) => p.filter((t) => t.key !== tile.key))
  }

  function check() {
    if (result || !placed.length) return
    // Compare the joined strings rather than the token arrays, so a different but
    // equivalent split (没 + 有 vs 没有) still counts. This exercise teaches word
    // order, not segmentation.
    const correct = placed.map((t) => t.hanzi).join('') === sentence.tokens.join('')
    setResult({ correct })
    gradeSentence(sentence.id, correct ? 2 : 0)
    if (correct) {
      setScore((s) => s + 1)
      speak(sentence.hanzi, 'zh-CN')
      advanceTimer.current = setTimeout(next, 1600)
    }
  }

  function next() {
    clearTimeout(advanceTimer.current)
    if (isLast) {
      setIndex(rounds.length)
      return
    }
    setIndex((i) => i + 1)
    setPlaced([])
    setResult(null)
  }

  return (
    <div className="session">
      <div className="session-top">
        <button className="ghost" onClick={onExit}>← Exit</button>
        <span className="muted">{index + 1} / {rounds.length} · {label}</span>
      </div>

      <div className="quiz-prompt">
        <span className="muted small">Build this sentence</span>
        <h2>{sentence.english}</h2>
      </div>

      <div className="tile-slots">
        {placed.map((tile) => (
          <button key={tile.key} className="tile" onClick={() => unplace(tile)}>
            {tile.hanzi}
            <span className="tile-pinyin">{tile.pinyin}</span>
          </button>
        ))}
      </div>

      <div className="tile-bank">
        {tiles.map((tile) => (
          // Placed tiles stay in the bank as hidden placeholders: removing them
          // outright reflows the bank on every tap, so your finger lands on the
          // wrong tile.
          <button
            key={tile.key}
            className={`tile${placedKeys.has(tile.key) ? ' ghosted' : ''}`}
            onClick={() => place(tile)}
            disabled={placedKeys.has(tile.key)}
            aria-hidden={placedKeys.has(tile.key)}
          >
            {tile.hanzi}
            <span className="tile-pinyin">{tile.pinyin}</span>
          </button>
        ))}
      </div>

      {!result && (
        <button className="primary wide" onClick={check} disabled={!placed.length}>
          Check
        </button>
      )}

      {result && (
        <div className={`type-feedback ${result.correct ? 'correct' : 'wrong'}`}>
          {result.correct ? (
            <span>✓ {sentence.hanzi} · {sentence.pinyin}</span>
          ) : (
            <>
              <span>
                ✗ <strong>{sentence.hanzi}</strong>
                <br />
                {sentence.pinyin}
              </span>
              {/* Unlike TypingView, a slip does not restart the run — losing ten
                  sentences to one word-order mistake is punishing, not instructive. */}
              <button className="primary wide" onClick={next} autoFocus>
                {isLast ? 'See results' : 'Next →'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
