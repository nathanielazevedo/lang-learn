import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

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

export default defineConfig(({ mode }) => {
  // Load all .env vars (including non-VITE_ ones) for the dev-only TTS endpoint.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), audioRegenPlugin(env)],
  }
})
