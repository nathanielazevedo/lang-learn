import { useCallback, useEffect, useState } from 'react'
import { review } from '../lib/srs.js'

const STORAGE_KEY = 'langlearn.progress.v1'

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

// Progress is a map of cardId -> SRS progress object, persisted to localStorage.
export function useProgress() {
  const [progress, setProgress] = useState(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }, [progress])

  const grade = useCallback((cardId, quality) => {
    setProgress((prev) => ({
      ...prev,
      [cardId]: review(prev[cardId], quality),
    }))
  }, [])

  const reset = useCallback(() => setProgress({}), [])

  return { progress, grade, reset }
}
