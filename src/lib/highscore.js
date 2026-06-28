// Client for the per-mode, per-level global high score. Fails soft (returns null)
// so the game still works if the API isn't configured yet.
export async function getHighScore(mode, level) {
  try {
    const res = await fetch(`/api/highscore?mode=${encodeURIComponent(mode)}&level=${level}`)
    if (!res.ok) return null
    return await res.json() // { score, name }
  } catch {
    return null
  }
}

// All records for the leaderboard: [{ scope, score, name }] | null
export async function getAllHighScores() {
  try {
    const res = await fetch('/api/highscore?all=1')
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function submitHighScore(mode, level, score, name) {
  try {
    const res = await fetch('/api/highscore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, level, score, name }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
