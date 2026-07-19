// Generate the sentence bank, and (with --relevel) derive the level assignment
// from the sentences themselves.
//
//   npm run sentences -- --relevel     # full sentence-first rebuild of levels + bank
//   npm run sentences -- --level 3     # regenerate level 3's sentences only
//   npm run sentences                  # top up any level that has too few sentences
//
// The sentence-first idea: for each level in order, the model gets the grammar
// pattern to teach, everything already assigned to earlier levels, and the pool of
// still-unassigned corpus words. Whatever words its sentences actually use become
// that level's vocabulary. Words are matched to the existing corpus by HANZI, so
// they keep their existing id — which is what preserves their mp3 and the learner's
// SRS history. Only words in curriculum.json's `additions` may be newly minted.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { words as corpus } from '../src/data/levels.js'
import { validateSentence, MAX_TOKENS } from '../src/lib/sentencecheck.js'
import { writeLevelsFile, writeSentencesFile } from './write-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const API_KEY = process.env.OPENAI_API_KEY
const MODEL = process.env.SENTENCE_MODEL || 'gpt-4o'
const TARGET = Number(process.env.SENTENCE_TARGET || 36)
const NEW_WORD_BUDGET = 50

const RELEVEL = process.argv.includes('--relevel')
const DRY_RUN = process.argv.includes('--dry-run')
const ONLY_LEVEL = (() => {
  const i = process.argv.indexOf('--level')
  return i === -1 ? null : Number(process.argv[i + 1])
})()

if (!API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable.')
  process.exit(1)
}

const curriculum = JSON.parse(await readFile(join(ROOT, 'scripts/curriculum.json'), 'utf8'))

// --- Vocabulary bookkeeping --------------------------------------------------
// 还 is the one hanzi with two distinct corpus entries (hái "still" / huán "to
// return something"), so a hanzi may map to several words. Resolution prefers a
// pinyin match and falls back to the first entry.
const byHanzi = new Map()
for (const w of corpus) {
  if (!byHanzi.has(w.hanzi)) byHanzi.set(w.hanzi, [])
  byHanzi.get(w.hanzi).push(w)
}

// Additions are the only vocabulary the model may use beyond the corpus. If a
// previous run already committed one, it is in the corpus now and is reused.
const additions = new Map()
for (const a of curriculum.additions) {
  if (byHanzi.has(a.hanzi)) continue
  additions.set(a.hanzi, { id: randomUUID(), ...a })
}

const allowed = [...corpus, ...additions.values()]
const allowedByHanzi = new Map(byHanzi)
for (const [hanzi, w] of additions) allowedByHanzi.set(hanzi, [w])

function resolveToken(hanzi, pinyinHint) {
  const matches = allowedByHanzi.get(hanzi)
  if (!matches || !matches.length) return null
  if (matches.length === 1) return matches[0]
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return matches.find((m) => norm(m.pinyin) === norm(pinyinHint)) || matches[0]
}

// --- The model call ----------------------------------------------------------
const SCHEMA = {
  type: 'object',
  properties: {
    sentences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tokens: { type: 'array', items: { type: 'string' } },
          hanzi: { type: 'string' },
          pinyin: { type: 'string' },
          english: { type: 'string' },
        },
        required: ['tokens', 'hanzi', 'pinyin', 'english'],
        additionalProperties: false,
      },
    },
  },
  required: ['sentences'],
  additionalProperties: false,
}

const vocabList = (list) => list.map((w) => `${w.hanzi}\t${w.pinyin}\t${w.english}`).join('\n')

function buildPrompt(spec, established, candidates, count) {
  const isFirst = established.length === 0
  return `Grammar focus for level ${spec.level} — ${spec.name}
${spec.focus}

Words this level MUST exercise: ${spec.required.join(' ')}
Example sentences in the target style: ${spec.examples.join('  ')}

${isFirst ? '' : `ALREADY TAUGHT (levels 1..${spec.level - 1}) — use these freely:
${vocabList(established)}

`}CANDIDATE WORDS — you may introduce up to ${NEW_WORD_BUDGET} of these in this level:
${vocabList(candidates)}

Write ${count} sentences that:
- use ONLY words from the lists above, each used as a WHOLE word from the list
- prominently exercise this level's grammar focus (at least two thirds of them)
- are ${isFirst ? '3-6' : '3-8'} words long, natural, and things a learner would actually say
- vary the subject, verb and object; do not reuse the same frame more than three times
- never merge two list entries into one token, and never split one entry into two
- write 没 and 有 as two separate tokens when they appear together

For each sentence return:
- tokens: array of words, each appearing VERBATIM in the lists above, in sentence order
- hanzi: the tokens joined together with no spaces, plus final punctuation
- pinyin: tone marks, one space between tokens
- english: a natural translation`
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Each call sends the whole vocabulary (~4k tokens), so a 30k tokens-per-minute
// account hits 429 quickly. Honour the wait the API suggests and back off.
async function callModel(messages) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.8,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'sentences', strict: true, schema: SCHEMA },
        },
      }),
    })

    if (res.status === 429 && attempt < 6) {
      const body = await res.text()
      const suggested = Number(body.match(/try again in ([\d.]+)s/)?.[1] || 0)
      const wait = Math.max(suggested + 1, 2 ** attempt * 2)
      console.log(`    rate limited, waiting ${wait.toFixed(1)}s…`)
      await sleep(wait * 1000)
      continue
    }
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)

    const data = await res.json()
    return JSON.parse(data.choices[0].message.content).sentences
  }
}

// The model occasionally emits punctuation as its own token. That is a formatting
// slip, not a vocabulary error — drop it rather than rejecting a good sentence.
const PUNCT_ONLY = /^[。，？！、：；""''《》…—\s]+$/
const cleanTokens = (s) => ({ ...s, tokens: (s.tokens || []).filter((t) => !PUNCT_ONLY.test(t)) })

// Generate for one level, validating and retrying once with the specific errors.
async function generateLevel(spec, established, candidates, existingHanzi, count) {
  const pool = [...established, ...candidates]
  const system =
    'You write short, natural Mandarin practice sentences for a word-tile ordering ' +
    'exercise. You never use a word outside the vocabulary you are given.'
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: buildPrompt(spec, established, candidates, count) },
  ]

  const accepted = []
  const seen = new Set(existingHanzi)

  for (let attempt = 0; attempt < 2; attempt++) {
    let batch
    try {
      batch = await callModel(messages)
    } catch (err) {
      console.error(`  ✗ ${err.message}`)
      break
    }

    const rejected = []
    for (const raw of batch) {
      const s = cleanTokens(raw)
      const errs = validateSentence(s, pool)
      if (errs.length) {
        rejected.push({ s, errs })
        continue
      }
      if (seen.has(s.hanzi)) continue // duplicate, drop quietly
      seen.add(s.hanzi)
      accepted.push(s)
    }

    console.log(`  attempt ${attempt + 1}: ${accepted.length} accepted, ${rejected.length} rejected`)
    for (const { s, errs } of rejected.slice(0, 5)) {
      console.log(`    ✗ ${s.hanzi} — ${errs[0]}`)
    }

    if (accepted.length >= count || !rejected.length) break
    if (attempt === 0) {
      messages.push({ role: 'assistant', content: JSON.stringify({ sentences: batch }) })
      messages.push({
        role: 'user',
        content:
          `These were rejected:\n` +
          rejected.map(({ s, errs }) => `${s.hanzi} — ${errs.join('; ')}`).join('\n') +
          `\n\nWrite ${count - accepted.length} replacement sentences that fix these problems. ` +
          `Every token must appear verbatim in the vocabulary lists, tokens must rejoin to ` +
          `exactly the hanzi, and sentences must be at most ${MAX_TOKENS} tokens.`,
      })
    }
  }
  await sleep(2000) // pace the next level's call against the per-minute budget
  return accepted
}

// --- Main --------------------------------------------------------------------
const assigned = new Map() // hanzi -> word object with its new level
const bank = []
const themes = {}
for (const spec of curriculum.levels) {
  themes[spec.level] = { name: spec.name, subtitle: spec.subtitle }
}

if (!RELEVEL) {
  // Top-up mode: the level assignment is frozen, sentences are generated against it.
  const { sentences: existing } = await import('../src/data/sentences.js').catch(() => ({ sentences: [] }))
  bank.push(...existing)
  const specs = curriculum.levels.filter((s) => (ONLY_LEVEL ? s.level === ONLY_LEVEL : true))
  for (const spec of specs) {
    const pool = corpus.filter((w) => w.level <= spec.level)
    const have = bank.filter((s) => s.level === spec.level)
    const need = TARGET - have.length
    if (need <= 0 && ONLY_LEVEL !== spec.level) {
      console.log(`Level ${spec.level}: ${have.length} sentences, nothing to do.`)
      continue
    }
    if (ONLY_LEVEL === spec.level) {
      for (let i = bank.length - 1; i >= 0; i--) if (bank[i].level === spec.level) bank.splice(i, 1)
    }
    console.log(`\nLevel ${spec.level} — ${spec.name} (pool ${pool.length} words)`)
    const fresh = await generateLevel(
      spec,
      pool.filter((w) => w.level < spec.level),
      pool.filter((w) => w.level === spec.level),
      bank.map((s) => s.hanzi),
      ONLY_LEVEL === spec.level ? TARGET : need
    )
    for (const s of fresh) {
      const tokenIds = s.tokens.map((t, i) => resolveToken(t, s.pinyin.split(/\s+/)[i])?.id)
      if (tokenIds.some((id) => !id)) continue
      bank.push({ id: randomUUID(), level: spec.level, ...s, tokenIds })
    }
  }
} else {
  // Sentence-first mode: sentences define each level's vocabulary.
  for (const spec of curriculum.levels) {
    const established = [...assigned.values()]
    const candidates = allowed.filter((w) => !assigned.has(w.hanzi))
    console.log(
      `\nLevel ${spec.level} — ${spec.name} ` +
        `(${established.length} established, ${candidates.length} candidates)`
    )

    const fresh = await generateLevel(spec, established, candidates, bank.map((s) => s.hanzi), TARGET)

    // Whatever words these sentences used become this level's vocabulary.
    for (const s of fresh) {
      const tokenIds = []
      let ok = true
      for (let i = 0; i < s.tokens.length; i++) {
        const word = resolveToken(s.tokens[i], s.pinyin.split(/\s+/)[i])
        if (!word) { ok = false; break }
        if (!assigned.has(word.hanzi)) {
          assigned.set(word.hanzi, { ...word, level: spec.level, order: assigned.size })
        }
        tokenIds.push(word.id)
      }
      if (!ok) continue
      bank.push({ id: randomUUID(), level: spec.level, ...s, tokenIds })
    }
    const introduced = [...assigned.values()].filter((w) => w.level === spec.level).length
    const got = bank.filter((s) => s.level === spec.level).length
    console.log(`  → ${introduced} words introduced, ${got} sentences`)

    // A level that produced nothing means its vocabulary was never derived. Writing
    // that out would silently strand every word the level should have introduced,
    // so stop before touching levels.js rather than committing a broken corpus.
    if (got === 0) {
      console.error(`\nAborting: level ${spec.level} produced no sentences, so its vocabulary is undefined.`)
      console.error('Nothing was written. Re-run once the cause (usually rate limiting) is resolved.')
      process.exit(1)
    }
  }
}

// Assemble the final word list.
let finalWords
if (RELEVEL) {
  // Sentence-derived words take their new level; anything no sentence used keeps
  // the level it already had, so prior curation is preserved rather than discarded.
  const out = []
  for (const w of corpus) {
    const moved = assigned.get(w.hanzi)
    out.push(moved && moved.id === w.id ? { ...w, level: moved.level } : { ...w })
  }
  for (const [hanzi, w] of additions) {
    const moved = assigned.get(hanzi)
    if (moved) out.push({ ...w, level: moved.level })
  }
  // Renumber `order` densely within each level.
  const byLevel = new Map()
  for (const w of out) {
    if (!byLevel.has(w.level)) byLevel.set(w.level, [])
    byLevel.get(w.level).push(w)
  }
  finalWords = []
  for (const [level, list] of byLevel) {
    list.forEach((w, i) => finalWords.push({ ...w, level, order: i + 1 }))
  }
} else {
  finalWords = corpus
}

if (DRY_RUN) {
  console.log('\n--dry-run: not writing files.')
} else {
  if (RELEVEL) {
    const n = await writeLevelsFile(finalWords, themes)
    console.log(`\nWrote src/data/levels.js (${n} words).`)
  }
  const n = await writeSentencesFile(bank)
  console.log(`Wrote src/data/sentences.js (${n} sentences).`)
}

console.log('\nPer level:')
for (const spec of curriculum.levels) {
  const w = finalWords.filter((x) => x.level === spec.level).length
  const s = bank.filter((x) => x.level === spec.level).length
  console.log(`  L${String(spec.level).padStart(2)} ${spec.name.padEnd(28)} ${String(w).padStart(3)} words  ${String(s).padStart(3)} sentences`)
}
console.log('\nNext: npm run validate && npm run audio')
