// A lightweight SM-2 style spaced-repetition scheduler.
// Each card's progress: { reps, interval (days), ease, due (timestamp), lapses }
const DAY = 24 * 60 * 60 * 1000

export function freshProgress() {
  return { reps: 0, interval: 0, ease: 2.5, due: Date.now(), lapses: 0 }
}

// quality: 0 = "Again", 1 = "Hard", 2 = "Good", 3 = "Easy"
export function review(progress, quality) {
  const p = progress ? { ...progress } : freshProgress()

  if (quality === 0) {
    // Failed: reset the learning step, keep ease but penalize.
    p.reps = 0
    p.interval = 0
    p.lapses += 1
    p.ease = Math.max(1.3, p.ease - 0.2)
    p.due = Date.now() + 1 * 60 * 1000 // see again in ~1 min this session
    return p
  }

  // Adjust ease based on how it went.
  const easeDelta = { 1: -0.15, 2: 0, 3: 0.15 }[quality] ?? 0
  p.ease = Math.max(1.3, p.ease + easeDelta)
  p.reps += 1

  if (p.reps === 1) {
    p.interval = quality === 3 ? 4 : 1
  } else if (p.reps === 2) {
    p.interval = quality === 3 ? 7 : 3
  } else {
    const mult = quality === 1 ? 1.2 : p.ease
    p.interval = Math.round(p.interval * mult)
  }

  p.due = Date.now() + p.interval * DAY
  return p
}

export function isDue(progress, now = Date.now()) {
  if (!progress) return true
  return progress.due <= now
}

export function masteryLevel(progress) {
  if (!progress || progress.reps === 0) return 'new'
  if (progress.interval >= 21) return 'mastered'
  if (progress.reps >= 2) return 'learning'
  return 'seen'
}
