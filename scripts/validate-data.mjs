// Validate the word corpus and the sentence bank.
//
//   npm run validate
//
// The load-bearing check is the first one: a word's `id` is the only link to its
// audio (public/audio/<id>.mp3) and to its SRS history in localStorage, so an id
// that disappears silently destroys both. src/data/word-ids.json is a snapshot of
// the ids that existed before the sentence-first re-leveling; every one of them
// must still be present. New ids may be added freely.
import { access, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { words, cardsUpToLevel } from '../src/data/levels.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const errors = []
const warnings = []
const fail = (msg) => errors.push(msg)
const warn = (msg) => warnings.push(msg)

const fileExists = async (p) => {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

// --- 1. No id may ever disappear -------------------------------------------
const snapshot = JSON.parse(await readFile(join(ROOT, 'src/data/word-ids.json'), 'utf8'))
const liveIds = new Set(words.map((w) => w.id))
const lost = snapshot.filter((id) => !liveIds.has(id))
if (lost.length) {
  fail(`${lost.length} word id(s) from word-ids.json no longer exist — audio and SRS history would be orphaned:`)
  for (const id of lost.slice(0, 10)) fail(`    ${id}`)
  if (lost.length > 10) fail(`    …and ${lost.length - 10} more`)
}

// --- 2. Ids are unique and well-formed --------------------------------------
const seen = new Map()
for (const w of words) {
  if (!UUID_RE.test(w.id)) fail(`${w.hanzi}: id is not a UUID: ${w.id}`)
  if (seen.has(w.id)) fail(`duplicate id ${w.id} — ${seen.get(w.id)} and ${w.hanzi}`)
  seen.set(w.id, w.hanzi)
}

// --- 3. level / order are a clean 1..N per level -----------------------------
const byLevel = new Map()
for (const w of words) {
  if (!Number.isInteger(w.level) || w.level < 1 || w.level > 10) {
    fail(`${w.hanzi}: level out of range: ${w.level}`)
    continue
  }
  if (!byLevel.has(w.level)) byLevel.set(w.level, [])
  byLevel.get(w.level).push(w)
}
for (const [level, cards] of [...byLevel].sort((a, b) => a[0] - b[0])) {
  const orders = cards.map((c) => c.order).sort((a, b) => a - b)
  const expected = cards.map((_, i) => i + 1)
  if (orders.join(',') !== expected.join(',')) {
    fail(`level ${level}: order is not exactly 1..${cards.length} (found ${orders.length} values, ` +
      `${new Set(orders).size} distinct, min ${orders[0]}, max ${orders[orders.length - 1]})`)
  }
}

// --- 4. Every word is fully populated ---------------------------------------
for (const w of words) {
  for (const field of ['hanzi', 'pinyin', 'english']) {
    if (!w[field] || !String(w[field]).trim()) fail(`${w.id}: empty ${field}`)
  }
}

// --- 5. Sentences use only their level's cumulative pool ---------------------
let sentenceCount = 0
if (await fileExists(join(ROOT, 'src/data/sentences.js'))) {
  const { sentences } = await import('../src/data/sentences.js')
  const { validateSentence } = await import('../src/lib/sentencecheck.js')
  sentenceCount = sentences.length

  const poolCache = new Map()
  const poolFor = (level) => {
    if (!poolCache.has(level)) poolCache.set(level, cardsUpToLevel(level))
    return poolCache.get(level)
  }

  const sentenceIds = new Set()
  const byHanzi = new Map()
  for (const s of sentences) {
    if (!UUID_RE.test(s.id)) fail(`sentence "${s.hanzi}": id is not a UUID: ${s.id}`)
    if (sentenceIds.has(s.id)) fail(`duplicate sentence id ${s.id}`)
    sentenceIds.add(s.id)
    if (byHanzi.has(s.hanzi)) fail(`duplicate sentence: ${s.hanzi} (levels ${byHanzi.get(s.hanzi)} and ${s.level})`)
    byHanzi.set(s.hanzi, s.level)

    for (const err of validateSentence(s, poolFor(s.level))) {
      fail(`L${s.level} "${s.hanzi}": ${err}`)
    }
    // tokenIds must resolve to real words, and to the right hanzi.
    for (let i = 0; i < (s.tokenIds || []).length; i++) {
      const word = words.find((w) => w.id === s.tokenIds[i])
      if (!word) fail(`L${s.level} "${s.hanzi}": tokenId ${s.tokenIds[i]} matches no word`)
      else if (word.hanzi !== s.tokens[i]) {
        fail(`L${s.level} "${s.hanzi}": tokenId[${i}] resolves to ${word.hanzi}, expected ${s.tokens[i]}`)
      }
    }
  }

  for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
    const n = sentences.filter((s) => s.level === level).length
    if (n === 0) warn(`level ${level} has no sentences yet`)
    else if (n < 15) warn(`level ${level} has only ${n} sentences (want 30+)`)
  }
} else {
  warn('src/data/sentences.js does not exist yet — skipping sentence checks')
}

// --- 6. Audio coverage (warning only) ---------------------------------------
let missingAudio = 0
for (const w of words) {
  if (!(await fileExists(join(ROOT, 'public', 'audio', `${w.id}.mp3`)))) missingAudio++
}
if (missingAudio) warn(`${missingAudio} of ${words.length} words have no mp3 — run \`npm run audio\``)

// --- Report ------------------------------------------------------------------
console.log(`Checked ${words.length} words across ${byLevel.size} levels, ${sentenceCount} sentences.`)
for (const w of warnings) console.warn(`  ! ${w}`)
if (errors.length) {
  console.error(`\n${errors.length} error(s):`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(1)
}
console.log(warnings.length ? `\nOK (${warnings.length} warning(s)).` : '\nOK.')
