import { describe, expect, test } from 'vitest'
import { normalizeActionsConfig } from './actions-config'

describe('normalizeActionsConfig', () => {
  test('returns null when no actions provided', () => {
    expect(normalizeActionsConfig(undefined)).toBeNull()
  })

  test('wraps action array in config object', () => {
    const actions = [
      { id: 'save', label: 'Save' },
      { id: 'cancel', label: 'Cancel' },
    ]

    const result = normalizeActionsConfig(actions)

    expect(result).toEqual({
      items: actions,
    })
  })

  test('returns config object with align and confirmTimeout when provided', () => {
    const config = {
      items: [{ id: 'apply', label: 'Apply' }],
      align: 'center' as const,
      confirmTimeout: 5000,
    }

    const result = normalizeActionsConfig(config)

    expect(result).toEqual({
      items: [{ id: 'apply', label: 'Apply' }],
      align: 'center',
      confirmTimeout: 5000,
    })
  })

  test('returns null when config has empty items array', () => {
    const config = {
      items: [],
      align: 'left' as const,
    }

    expect(normalizeActionsConfig(config)).toBeNull()
  })
})
