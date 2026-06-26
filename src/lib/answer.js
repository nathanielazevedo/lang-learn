// Forgiving answer checking for typed responses.

// Remove pinyin tone marks: "nǐ hǎo" -> "ni hao"
function stripTones(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Collapse to a comparable form: lowercase, no tones, no spaces/punctuation.
function normalize(s) {
  return stripTones(s).toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Expand an expected answer into all acceptable variants:
//  - strips parenthetical hints:  "you (plural)" -> "you"
//  - splits slash alternatives:   "he / she / it" -> ["he", "she", "it"]
//  - allows dropping a leading article/"to": "to eat" also accepts "eat"
export function expectedAlternatives(expected) {
  const cleaned = expected.replace(/\([^)]*\)/g, ' ')
  const parts = cleaned.split('/').map((s) => s.trim()).filter(Boolean)
  const alts = new Set()
  for (const p of parts) {
    alts.add(p)
    const lower = p.toLowerCase()
    if (lower.startsWith('to ')) alts.add(p.slice(3))
    if (lower.startsWith('a ')) alts.add(p.slice(2))
    if (lower.startsWith('the ')) alts.add(p.slice(4))
  }
  return [...alts]
}

// Pinyin answers accept tones-optional input; English ignores articles & case.
export function checkAnswer(input, expected) {
  const n = normalize(input)
  if (!n) return false
  return expectedAlternatives(expected).some((alt) => normalize(alt) === n)
}
