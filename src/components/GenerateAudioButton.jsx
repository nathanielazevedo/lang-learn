import { useState } from 'react'
import { generateDeckAudio } from '../lib/audio.js'

// Dev-only button that generates pronunciation mp3s for any of the given cards
// that don't have one yet (existing files are skipped server-side).
export default function GenerateAudioButton({ cards, label = 'whole deck' }) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null) // { done, total } | null
  const [msg, setMsg] = useState(null) // result string | null

  if (!import.meta.env.DEV) return null

  async function run() {
    setBusy(true)
    setMsg(null)
    setProgress({ done: 0, total: cards.length })
    try {
      const n = await generateDeckAudio(cards, setProgress)
      setMsg(n ? `Added ${n} new audio file${n === 1 ? '' : 's'}.` : 'All words already have audio.')
    } catch (e) {
      setMsg(`⚠️ ${e.message || e}`)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div className="dev-tools">
      <button className="ghost" disabled={busy} onClick={run}>
        {busy
          ? `Generating audio… ${progress?.done ?? 0}/${progress?.total ?? 0}`
          : `Generate missing audio (${label})`}
      </button>
      {msg && <span className="dev-note">{msg}</span>}
    </div>
  )
}
