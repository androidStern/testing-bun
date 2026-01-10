import { describe, expect, test } from 'vitest'
import { createProfileInput } from '@/test'
import { profileMutationSchema } from './profile'

/**
 * Only test profileMutationSchema (server-side auth validation).
 *
 * profileFormSchema tests were removed because:
 * - They test Zod's built-in URL/string validation (library behavior)
 * - Form-level validation is tested in ProfileForm.test.tsx
 * - These tests added no coverage for business logic
 */
describe('profileMutationSchema', () => {
  const baseInput = {
    ...createProfileInput(),
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    workosUserId: 'user_123',
  }

  test('extends form schema with auth fields', () => {
    const result = profileMutationSchema.parse(baseInput)

    expect(result.workosUserId).toBe('user_123')
    expect(result.email).toBe('test@example.com')
    expect(result.firstName).toBe('Test')
    expect(result.lastName).toBe('User')
  })

  test('requires workosUserId', () => {
    expect(() =>
      profileMutationSchema.parse({
        ...baseInput,
        workosUserId: '',
      }),
    ).toThrow()
  })

  test('requires valid email', () => {
    expect(() =>
      profileMutationSchema.parse({
        ...baseInput,
        email: 'invalid-email',
      }),
    ).toThrow()
  })

  test('transforms empty firstName/lastName to undefined', () => {
    const result = profileMutationSchema.parse({
      ...baseInput,
      firstName: '',
      lastName: '',
    })

    expect(result.firstName).toBeUndefined()
    expect(result.lastName).toBeUndefined()
  })

  test('accepts optional referredByCode', () => {
    const result = profileMutationSchema.parse({
      ...baseInput,
      referredByCode: 'REF123',
    })

    expect(result.referredByCode).toBe('REF123')
  })
})
