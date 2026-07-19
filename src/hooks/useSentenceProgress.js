import { useCallback, useEffect, useState } from 'react'
import { review } from '../lib/srs.js'

const STORAGE_KEY = 'langlearn.sentences.v1'

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

// Sentence progress lives in its own namespace, keyed by sentence id, so that
// building sentences never touches word-level SRS. A mis-ordered sentence is
// almost always a word-order slip rather than a vocabulary failure, and grading
// its words as forgotten would reset intervals and rack up lapses for words the
// learner knows perfectly well. The scheduling itself is the same SM-2 variant —
// `review` is a pure function over a progress record, so it works unchanged here.
export function useSentenceProgress() {
  const [progress, setProgress] = useState(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }, [progress])

  const gradeSentence = useCallback((sentenceId, quality) => {
    setProgress((prev) => ({
      ...prev,
      [sentenceId]: review(prev[sentenceId], quality),
    }))
  }, [])

  const reset = useCallback(() => setProgress({}), [])

  return { sentenceProgress: progress, gradeSentence, resetSentences: reset }
}
