import { speak, speechAvailable } from '../lib/speech.js'

// `text` is what gets spoken (hanzi for accurate TTS); `label` is what the user
// knows the word as (pinyin), used for the accessible label only.
export default function SpeakButton({ text, label, size = '' }) {
  if (!speechAvailable() || !text) return null
  return (
    <button
      type="button"
      className={`speak-btn ${size}`}
      onClick={(e) => {
        e.stopPropagation()
        speak(text)
      }}
      aria-label={`Play pronunciation of ${label || text}`}
      title="Play pronunciation"
    >
      🔊
    </button>
  )
}
