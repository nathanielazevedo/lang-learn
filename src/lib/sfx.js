// Tiny Web Audio sound effects — no files, generated on the fly.
let ctx
let enabled = true

function ac() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function blip(freq, dur, type = 'sine', gain = 0.05) {
  if (!enabled) return
  const a = ac()
  if (!a) return
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(g)
  g.connect(a.destination)
  const t = a.currentTime
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.start(t)
  osc.stop(t + dur)
}

export const sfx = {
  setEnabled(v) { enabled = v },
  // Pitch rises with the combo for a satisfying streak feel.
  correct(combo = 0) { blip(520 + Math.min(combo, 12) * 45, 0.12, 'triangle', 0.06) },
  wrong() { blip(150, 0.28, 'sawtooth', 0.07) },
  start() { blip(440, 0.08, 'square', 0.05) },
  gameOver() {
    blip(330, 0.16, 'triangle', 0.06)
    setTimeout(() => blip(247, 0.16, 'triangle', 0.06), 130)
    setTimeout(() => blip(196, 0.34, 'triangle', 0.06), 260)
  },
}
