import { describe, expect, test } from 'vitest'
import { profileFormSchema, profileMutationSchema } from './profile'

describe('profileFormSchema', () => {
  describe('optionalString transform', () => {
    test('transforms empty string to undefined', () => {
      const result = profileFormSchema.parse({
        bio: 'Summary',
        headline: 'Manager',
        instagramUrl: '',
        linkedinUrl: '',
        location: '',
        resumeLink: '',
        thingsICanOffer: ['To find a job'],
        website: '',
      })

      expect(result.location).toBeUndefined()
      expect(result.website).toBeUndefined()
      expect(result.linkedinUrl).toBeUndefined()
      expect(result.instagramUrl).toBeUndefined()
      expect(result.resumeLink).toBeUndefined()
    })

    test('preserves non-empty strings', () => {
      const result = profileFormSchema.parse({
        bio: 'Summary',
        headline: 'Manager',
        instagramUrl: '',
        linkedinUrl: 'https://linkedin.com/in/test',
        location: 'Miami, FL',
        resumeLink: '',
        thingsICanOffer: ['To find a job'],
        website: 'https://example.com',
      })

      expect(result.location).toBe('Miami, FL')
      expect(result.website).toBe('https://example.com')
      expect(result.linkedinUrl).toBe('https://linkedin.com/in/test')
    })
  })

  describe('URL validation', () => {
    test('accepts valid URLs', () => {
      const result = profileFormSchema.parse({
        bio: 'Summary',
        headline: 'Manager',
        instagramUrl: 'https://instagram.com/test',
        linkedinUrl: 'https://linkedin.com/in/test',
        location: '',
        resumeLink: 'https://example.com/resume.pdf',
        thingsICanOffer: ['To find a job'],
        website: 'https://example.com',
      })

      expect(result.website).toBe('https://example.com')
      expect(result.linkedinUrl).toBe('https://linkedin.com/in/test')
    })

    test('rejects invalid URLs for website', () => {
      expect(() =>
        profileFormSchema.parse({
          bio: 'Summary',
          headline: 'Manager',
          instagramUrl: '',
          linkedinUrl: '',
          location: '',
          resumeLink: '',
          thingsICanOffer: ['To find a job'],
          website: 'not-a-url',
        }),
      ).toThrow()
    })

    test('rejects invalid URLs for linkedinUrl', () => {
      expect(() =>
        profileFormSchema.parse({
          bio: 'Summary',
          headline: 'Manager',
          instagramUrl: '',
          linkedinUrl: 'not-a-url',
          location: '',
          resumeLink: '',
          thingsICanOffer: ['To find a job'],
          website: '',
        }),
      ).toThrow()
    })

    test('rejects invalid URLs for instagramUrl', () => {
      expect(() =>
        profileFormSchema.parse({
          bio: 'Summary',
          headline: 'Manager',
          instagramUrl: 'not-a-url',
          linkedinUrl: '',
          location: '',
          resumeLink: '',
          thingsICanOffer: ['To find a job'],
          website: '',
        }),
      ).toThrow()
    })

    test('rejects invalid URLs for resumeLink', () => {
      expect(() =>
        profileFormSchema.parse({
          bio: 'Summary',
          headline: 'Manager',
          instagramUrl: '',
          linkedinUrl: '',
          location: '',
          resumeLink: 'not-a-url',
          thingsICanOffer: ['To find a job'],
          website: '',
        }),
      ).toThrow()
    })
  })

  describe('required fields', () => {
    test('requires thingsICanOffer with at least 1 item', () => {
      expect(() =>
        profileFormSchema.parse({
          bio: 'Summary',
          headline: 'Manager',
          instagramUrl: '',
          linkedinUrl: '',
          location: '',
          resumeLink: '',
          thingsICanOffer: [],
          website: '',
        }),
      ).toThrow()
    })

    test('requires headline to be non-empty', () => {
      expect(() =>
        profileFormSchema.parse({
          bio: 'Summary',
          headline: '',
          instagramUrl: '',
          linkedinUrl: '',
          location: '',
          resumeLink: '',
          thingsICanOffer: ['To find a job'],
          website: '',
        }),
      ).toThrow()
    })

    test('requires bio to be non-empty', () => {
      expect(() =>
        profileFormSchema.parse({
          bio: '',
          headline: 'Manager',
          instagramUrl: '',
          linkedinUrl: '',
          location: '',
          resumeLink: '',
          thingsICanOffer: ['To find a job'],
          website: '',
        }),
      ).toThrow()
    })
  })

  describe('multiple thingsICanOffer selections', () => {
    test('accepts multiple selections', () => {
      const result = profileFormSchema.parse({
        bio: 'Summary',
        headline: 'Manager',
        instagramUrl: '',
        linkedinUrl: '',
        location: '',
        resumeLink: '',
        thingsICanOffer: ['To find a job', 'To lend a hand', 'Entrepreneurship'],
        website: '',
      })

      expect(result.thingsICanOffer).toHaveLength(3)
      expect(result.thingsICanOffer).toContain('To find a job')
      expect(result.thingsICanOffer).toContain('To lend a hand')
      expect(result.thingsICanOffer).toContain('Entrepreneurship')
    })
  })
})

describe('profileMutationSchema', () => {
  test('extends form schema with auth fields', () => {
    const result = profileMutationSchema.parse({
      bio: 'Summary',
      email: 'test@example.com',
      firstName: 'Test',
      headline: 'Manager',
      instagramUrl: '',
      lastName: 'User',
      linkedinUrl: '',
      location: '',
      resumeLink: '',
      thingsICanOffer: ['To find a job'],
      website: '',
      workosUserId: 'user_123',
    })

    expect(result.workosUserId).toBe('user_123')
    expect(result.email).toBe('test@example.com')
    expect(result.firstName).toBe('Test')
    expect(result.lastName).toBe('User')
  })

  test('requires workosUserId', () => {
    expect(() =>
      profileMutationSchema.parse({
        bio: 'Summary',
        email: 'test@example.com',
        firstName: 'Test',
        headline: 'Manager',
        instagramUrl: '',
        lastName: 'User',
        linkedinUrl: '',
        location: '',
        resumeLink: '',
        thingsICanOffer: ['To find a job'],
        website: '',
        workosUserId: '',
      }),
    ).toThrow()
  })

  test('requires valid email', () => {
    expect(() =>
      profileMutationSchema.parse({
        bio: 'Summary',
        email: 'invalid-email',
        firstName: 'Test',
        headline: 'Manager',
        instagramUrl: '',
        lastName: 'User',
        linkedinUrl: '',
        location: '',
        resumeLink: '',
        thingsICanOffer: ['To find a job'],
        website: '',
        workosUserId: 'user_123',
      }),
    ).toThrow()
  })

  test('transforms empty firstName/lastName to undefined', () => {
    const result = profileMutationSchema.parse({
      bio: 'Summary',
      email: 'test@example.com',
      firstName: '',
      headline: 'Manager',
      instagramUrl: '',
      lastName: '',
      linkedinUrl: '',
      location: '',
      resumeLink: '',
      thingsICanOffer: ['To find a job'],
      website: '',
      workosUserId: 'user_123',
    })

    expect(result.firstName).toBeUndefined()
    expect(result.lastName).toBeUndefined()
  })

  test('accepts optional referredByCode', () => {
    const result = profileMutationSchema.parse({
      bio: 'Summary',
      email: 'test@example.com',
      firstName: 'Test',
      headline: 'Manager',
      instagramUrl: '',
      lastName: 'User',
      linkedinUrl: '',
      location: '',
      referredByCode: 'REF123',
      resumeLink: '',
      thingsICanOffer: ['To find a job'],
      website: '',
      workosUserId: 'user_123',
    })

    expect(result.referredByCode).toBe('REF123')
  })
})
