import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'jobMatcher.promptOverride'

export function usePromptOverride() {
  const [promptOverride, setPromptOverrideState] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setPromptOverrideState(stored)
    setIsLoaded(true)
  }, [])

  const setPromptOverride = useCallback((value: string | null) => {
    setPromptOverrideState(value)
    if (value === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, value)
    }
  }, [])

  const clearOverride = useCallback(() => {
    setPromptOverride(null)
  }, [setPromptOverride])

  const isDirty = promptOverride !== null

  return {
    clearOverride,
    isDirty,
    isLoaded,
    promptOverride,
    setPromptOverride,
  }
}
