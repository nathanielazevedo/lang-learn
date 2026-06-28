// Plays pre-generated pronunciation files (public/audio/<id>.mp3) when present,
// falling back to browser speech synthesis when a file is missing.
import { speak, speakThen, stopSpeaking } from './speech.js'

let current = null // the <audio> element currently playing, so we can stop it

function audioUrl(card) {
  return `${import.meta.env.BASE_URL}audio/${card.id}.mp3`
}

// Fire-and-forget — used by tap-to-hear buttons.
export function playWord(card) {
  if (!card) return
  stopAudio()
  const audio = new Audio(audioUrl(card))
  current = audio
  let settled = false
  const fallback = () => {
    if (settled) return
    settled = true
    speak(card.hanzi || card.term, 'zh-CN')
  }
  audio.onerror = fallback
  audio.play().then(() => { settled = true }).catch(fallback)
}

// Play the word's Chinese audio, then run onDone when it finishes (or after the
// fallback speech finishes). Used by Listen mode to sequence front/back/next.
export function playWordThen(card, onDone) {
  stopAudio()
  const audio = new Audio(audioUrl(card))
  current = audio
  let settled = false
  const done = () => {
    if (settled) return
    settled = true
    if (current === audio) current = null
    onDone?.()
  }
  const fallback = () => {
    if (settled) return
    settled = true
    if (current === audio) current = null
    speakThen(card.hanzi || card.term, 'zh-CN', onDone)
  }
  audio.onended = done
  audio.onerror = fallback
  audio.play().catch(fallback)
}

export function stopAudio() {
  if (current) {
    try { current.pause() } catch { /* ignore */ }
    current = null
  }
  stopSpeaking()
}

// Dev only: ask the dev server to (re)generate this word's audio file.
export async function regenerateAudio(card) {
  const res = await fetch('/__regen-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: card.id, text: card.hanzi || card.term }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Request failed (${res.status})`)
  }
}

// Play a freshly written file, bypassing the browser cache.
export function playFresh(card) {
  stopAudio()
  const audio = new Audio(`${audioUrl(card)}?t=${Date.now()}`)
  current = audio
  audio.play().catch(() => {})
}
