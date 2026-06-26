import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'langlearn.settings.v1'
const DEFAULTS = { direction: 'pinyin-first' } // or 'english-first'

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const update = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  return { settings, update }
}
