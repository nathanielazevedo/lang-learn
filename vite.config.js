import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createHighScoreStore, makeScope, cleanName } from './server/highscore.mjs'

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

// Dev-only endpoint to (re)generate one word's pronunciation via OpenAI TTS and
// write it to public/audio/<id>.mp3. Used by the word List page. The API key
// stays on the server (read from OPENAI_API_KEY when you run `npm run dev`).
function audioRegenPlugin(env) {
  return {
    name: 'audio-regen',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__regen-audio', async (req, res) => {
        const json = (status, obj) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
        }
        if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

        const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY
        if (!apiKey) return json(500, { error: 'OPENAI_API_KEY not set — add it to your .env file' })

        try {
          const { id, text } = await readJson(req)
          if (!id || !/^[\w-]+$/.test(id)) return json(400, { error: 'Invalid id' })
          if (!text) return json(400, { error: 'Missing text' })

          const model = env.TTS_MODEL || process.env.TTS_MODEL || 'gpt-4o-mini-tts'
          const voice = env.TTS_VOICE || process.env.TTS_VOICE || 'alloy'
          const payload = { model, voice, input: text, response_format: 'mp3' }
          if (model.startsWith('gpt-4o')) {
            payload.instructions =
              'Pronounce this Mandarin Chinese word clearly and at a slightly slow, natural pace.'
          }

          const r = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!r.ok) return json(502, { error: `OpenAI ${r.status}: ${await r.text()}` })

          const buf = Buffer.from(await r.arrayBuffer())
          const dir = join(process.cwd(), 'public', 'audio')
          await mkdir(dir, { recursive: true })
          await writeFile(join(dir, `${id}.mp3`), buf)
          json(200, { ok: true })
        } catch (e) {
          json(500, { error: String(e?.message || e) })
        }
      })
    },
  }
}

// Dev middleware mirroring the /api/highscore Vercel function, so the shared
// high score works under `npm run dev` too (reads Upstash creds from .env).
function highScorePlugin(env) {
  return {
    name: 'highscore-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/highscore', async (req, res) => {
        const json = (status, obj) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
        }
        const pick = (...names) => names.map((n) => env[n] || process.env[n]).find(Boolean)
        const url = pick('SUPABASE_URL', 'langlearn_SUPABASE_URL', 'NEXT_PUBLIC_langlearn_SUPABASE_URL')
        const key = pick('SUPABASE_SERVICE_ROLE_KEY', 'langlearn_SUPABASE_SERVICE_ROLE_KEY')
        if (!url || !key) return json(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env' })
        const store = createHighScoreStore({ url, key })
        try {
          if (req.method === 'GET') {
            const params = new URL(req.originalUrl || req.url, 'http://localhost').searchParams
            if (params.has('all')) return json(200, await store.getAll())
            const scope = makeScope(params.get('mode'), params.get('level'))
            if (!scope) return json(400, { error: 'Invalid mode/level' })
            return json(200, await store.get(scope))
          }
          if (req.method === 'POST') {
            const body = await readJson(req)
            const scope = makeScope(body.mode, body.level)
            if (!scope) return json(400, { error: 'Invalid mode/level' })
            const score = Math.floor(Number(body.score))
            if (!Number.isFinite(score) || score < 0 || score > 1_000_000) {
              return json(400, { error: 'Invalid score' })
            }
            return json(200, await store.submit(scope, score, cleanName(body.name)))
          }
          json(405, { error: 'Method not allowed' })
        } catch (e) {
          json(500, { error: String(e?.message || e) })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load all .env vars (including non-VITE_ ones) for the dev-only endpoints.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), audioRegenPlugin(env), highScorePlugin(env)],
  }
})
