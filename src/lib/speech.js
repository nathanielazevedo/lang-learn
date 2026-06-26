// Pronunciation via the browser's built-in Speech Synthesis.
// We only have pinyin (no characters), so Chinese is spoken from the hidden hanzi
// with a zh voice; English is spoken with an en voice. No network or API key.
export function speechAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickVoice(lang) {
  const voices = window.speechSynthesis.getVoices() || []
  const prefix = lang.slice(0, 2).toLowerCase()
  return (
    voices.find((v) => v.lang?.toLowerCase().replace('_', '-') === lang.toLowerCase()) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(prefix)) ||
    null
  )
}

function makeUtterance(text, lang, rate) {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = rate
  const voice = pickVoice(lang)
  if (voice) u.voice = voice
  return u
}

// Fire-and-forget: used by tap-to-hear buttons.
export function speak(text, lang = 'zh-CN', rate = 0.9) {
  if (!speechAvailable() || !text) return
  const synth = window.speechSynthesis
  synth.cancel() // stop anything already playing
  synth.speak(makeUtterance(text, lang, rate))
}

// Speak, then run `onDone` when finished (or immediately if speech is unavailable).
// Used by Listen mode to chain front -> pause -> back -> next.
export function speakThen(text, lang, onDone, rate = 0.85) {
  if (!speechAvailable() || !text) {
    onDone?.()
    return
  }
  const synth = window.speechSynthesis
  synth.cancel()
  const u = makeUtterance(text, lang, rate)
  let fired = false
  const finish = () => {
    if (fired) return
    fired = true
    onDone?.()
  }
  u.onend = finish
  u.onerror = finish
  synth.speak(u)
}

export function stopSpeaking() {
  if (speechAvailable()) window.speechSynthesis.cancel()
}
