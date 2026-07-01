// Build a .txt of a word set plus a ready-to-paste prompt, and download it.
// The prompt tells ChatGPT to hold a conversation using ONLY these words —
// useful for practicing a level (or everything you know) in a real chat.
export function downloadWordsForChatGPT(cards, label) {
  const list = cards.map((c) => `${c.hanzi}\t${c.pinyin}\t${c.english}`).join('\n')
  const text = `I'm learning Mandarin Chinese. Below is a set of ${cards.length} words (${label}).

Please have a natural spoken-style conversation with me in Mandarin using ONLY these words — do not introduce any vocabulary or characters outside this list. Keep your sentences short and reuse words often. After each Chinese sentence, add the pinyin and an English translation on their own lines. Start by greeting me and asking a simple question.

If staying strictly inside the list makes a reply impossible, tell me which word I'm missing instead of using an outside word.

Word list (hanzi — pinyin — meaning):
${list}
`
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'words'
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mandarin-${slug}-words.txt`
  a.click()
  URL.revokeObjectURL(url)
}
