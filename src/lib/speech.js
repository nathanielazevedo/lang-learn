// Pronunciation via the browser's built-in Speech Synthesis.
// We only have pinyin (no characters), so we speak it with a Chinese voice when
// one is available — quality varies by platform but needs no network or API key.
export function speechAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickChineseVoice() {
  const voices = window.speechSynthesis.getVoices() || []
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith('zh')) || null
  )
}

export function speak(text, lang = 'zh-CN') {
  if (!speechAvailable() || !text) return
  const synth = window.speechSynthesis
  synth.cancel() // stop anything already playing
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = 0.9
  const voice = pickChineseVoice()
  if (voice) u.voice = voice
  synth.speak(u)
}
