import { playWord } from '../lib/audio.js'

// Plays the word's pronunciation (pre-generated file, or browser TTS fallback).
export default function SpeakButton({ card, size = '' }) {
  if (!card) return null
  return (
    <button
      type="button"
      className={`speak-btn ${size}`}
      onClick={(e) => {
        e.stopPropagation()
        playWord(card)
      }}
      aria-label={`Play pronunciation of ${card.pinyin}`}
      title="Play pronunciation"
    >
      🔊
    </button>
  )
}
