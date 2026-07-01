export default function Flashcard({ card, flipped, onFlip, direction = 'pinyin-first' }) {
  const pinyinFirst = direction === 'pinyin-first'
  const frontText = pinyinFirst ? card.pinyin : card.english
  const backText = pinyinFirst ? card.english : card.pinyin
  const frontCls = pinyinFirst ? 'term' : 'translation'
  const backCls = pinyinFirst ? 'translation' : 'term'

  return (
    <button
      className={`flashcard ${flipped ? 'flipped' : ''}`}
      onClick={onFlip}
      aria-label="Flashcard, click to flip"
    >
      <div className="flashcard-inner">
        <div className="flashcard-face front">
          <span className={frontCls}>{frontText}</span>
          <span className="hint">tap to reveal</span>
        </div>
        <div className="flashcard-face back">
          <span className={backCls}>{backText}</span>
          {card.example && <span className="example">“{card.example}”</span>}
        </div>
      </div>
    </button>
  )
}
