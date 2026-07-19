// Proves a generated sentence is legal for the level it claims.
//
// Chinese is never segmented in JS — segmentation is hard, and there is no
// dependency here to do it with. Instead the generator hands us an explicit
// `tokens` array and this module proves it: every token must be a whole word from
// the pool, AND the tokens must rejoin into exactly the displayed sentence. That
// second check is what makes it airtight — a model that sneaks in an out-of-pool
// character cannot hide it, because either the character surfaces as a rejected
// token or the rejoin fails to match.
//
// Shared by scripts/generate-sentences.mjs and scripts/validate-data.mjs.

const PUNCT = /[。，？！、：；""''《》…—\s]/g

export const MIN_TOKENS = 2
export const MAX_TOKENS = 9

// Returns a list of human-readable problems. Empty means the sentence is legal.
export function validateSentence(sentence, pool) {
  const inPool = new Set(pool.map((c) => c.hanzi))
  const errs = []
  const tokens = sentence.tokens

  if (!Array.isArray(tokens) || tokens.length < MIN_TOKENS) {
    errs.push(`needs at least ${MIN_TOKENS} tokens`)
    return errs
  }
  if (tokens.length > MAX_TOKENS) errs.push(`too long (${tokens.length} tokens, max ${MAX_TOKENS})`)

  for (const t of tokens) {
    if (typeof t !== 'string' || !t.trim()) errs.push('empty token')
    else if (!inPool.has(t)) errs.push(`out-of-pool token: ${t}`)
  }

  // The tiles must reconstruct the sentence exactly, punctuation aside.
  const joined = tokens.join('')
  const stripped = String(sentence.hanzi || '').replace(PUNCT, '')
  if (joined !== stripped) {
    errs.push(`tokens don't reconstruct hanzi: "${joined}" ≠ "${stripped}"`)
  }

  if (!String(sentence.english || '').trim()) errs.push('missing english')
  if (!String(sentence.pinyin || '').trim()) errs.push('missing pinyin')

  if (sentence.tokenIds && sentence.tokenIds.length !== tokens.length) {
    errs.push(`tokenIds/tokens length mismatch (${sentence.tokenIds.length} vs ${tokens.length})`)
  }

  return errs
}

// Strip punctuation from a sentence — used to compare a learner's assembled
// tiles against the answer.
export function stripPunct(hanzi) {
  return String(hanzi || '').replace(PUNCT, '')
}
