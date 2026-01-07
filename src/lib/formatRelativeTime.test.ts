import { beforeEach, describe, expect, test, vi } from 'vitest'
import { formatRelativeTime } from './formatRelativeTime'

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
  })

  test('returns "just now" for timestamps less than 60 seconds ago', () => {
    const now = Date.now()
    const thirtySecondsAgo = now - 30 * 1000

    expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now')
  })

  test('returns minutes ago for timestamps less than 60 minutes ago', () => {
    const now = Date.now()
    const fifteenMinutesAgo = now - 15 * 60 * 1000

    expect(formatRelativeTime(fifteenMinutesAgo)).toBe('15m ago')
  })

  test('returns hours ago for timestamps less than 24 hours ago', () => {
    const now = Date.now()
    const fiveHoursAgo = now - 5 * 60 * 60 * 1000

    expect(formatRelativeTime(fiveHoursAgo)).toBe('5h ago')
  })

  test('returns days ago for timestamps more than 24 hours ago', () => {
    const now = Date.now()
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000

    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago')
  })

  test('returns "1m ago" at exactly 60 seconds', () => {
    const now = Date.now()
    const oneMinuteAgo = now - 60 * 1000

    expect(formatRelativeTime(oneMinuteAgo)).toBe('1m ago')
  })

  test('returns "1h ago" at exactly 60 minutes', () => {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000

    expect(formatRelativeTime(oneHourAgo)).toBe('1h ago')
  })

  test('returns "1d ago" at exactly 24 hours', () => {
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    expect(formatRelativeTime(oneDayAgo)).toBe('1d ago')
  })
})
