// Shared global high-score store backed by Supabase (Postgres via PostgREST).
// A separate record is kept per game mode + level (the "scope").
// Used by both the Vercel function (api/highscore.js) and the Vite dev middleware.
const MODES = new Set(['word', 'audio'])

// Build a safe storage scope from a mode + level, or null if invalid.
export function makeScope(mode, level) {
  if (!MODES.has(mode)) return null
  const lvl = Math.floor(Number(level))
  if (!Number.isInteger(lvl) || lvl < 1 || lvl > 50) return null
  return `${mode}:L${lvl}`
}

// Optional display name: letters/numbers/spaces, trimmed, max 12 chars.
export function cleanName(name) {
  return String(name || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 12)
}

export function createHighScoreStore({ url, key }) {
  const base = `${url.replace(/\/$/, '')}/rest/v1`
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }

  async function get(scope) {
    const res = await fetch(
      `${base}/high_scores?scope=eq.${encodeURIComponent(scope)}&select=score,name`,
      { headers },
    )
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
    const rows = await res.json()
    const row = rows[0]
    return { score: Number(row?.score || 0), name: row?.name || '' }
  }

  // Every record, for the leaderboard: [{ scope, score, name }]
  async function getAll() {
    const res = await fetch(`${base}/high_scores?select=scope,score,name`, { headers })
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
    return await res.json()
  }

  // Calls the submit_score() SQL function, which only overwrites if the new
  // score is higher, then returns the current record (atomic).
  async function submit(scope, score, name) {
    const res = await fetch(`${base}/rpc/submit_score`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_scope: scope, p_score: score, p_name: name }),
    })
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
    const rows = await res.json()
    const row = Array.isArray(rows) ? rows[0] : rows
    return { score: Number(row?.score || 0), name: row?.name || '' }
  }

  return { get, getAll, submit }
}
