import { createHighScoreStore, makeScope, cleanName } from '../server/highscore.mjs'

function getStore() {
  // Plain names locally; Vercel's Supabase integration injects prefixed ones.
  const url =
    process.env.SUPABASE_URL ||
    process.env.langlearn_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_langlearn_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.langlearn_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createHighScoreStore({ url, key })
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  let data = ''
  for await (const chunk of req) data += chunk
  try {
    return JSON.parse(data || '{}')
  } catch {
    return {}
  }
}

// GET ?mode=&level=  -> { score, name }
// POST { mode, level, score, name } -> updated { score, name }
export default async function handler(req, res) {
  const store = getStore()
  if (!store) return res.status(500).json({ error: 'High score storage not configured' })

  try {
    if (req.method === 'GET') {
      if (req.query.all !== undefined) return res.status(200).json(await store.getAll())
      const scope = makeScope(req.query.mode, req.query.level)
      if (!scope) return res.status(400).json({ error: 'Invalid mode/level' })
      return res.status(200).json(await store.get(scope))
    }
    if (req.method === 'POST') {
      const body = await readBody(req)
      const scope = makeScope(body.mode, body.level)
      if (!scope) return res.status(400).json({ error: 'Invalid mode/level' })
      const score = Math.floor(Number(body.score))
      if (!Number.isFinite(score) || score < 0 || score > 1_000_000) {
        return res.status(400).json({ error: 'Invalid score' })
      }
      return res.status(200).json(await store.submit(scope, score, cleanName(body.name)))
    }
    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
}
