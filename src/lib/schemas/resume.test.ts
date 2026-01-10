import { describe, expect, test } from 'vitest'
import {
  createDefaultResumeFormValues,
  createEmptyEducation,
  createEmptyWorkExperience,
  resumeMutationSchema,
} from './resume'

/**
 * Only test mutation schema and factory functions.
 *
 * resumeFormSchema tests were removed because:
 * - They test Zod's built-in email/URL/string validation (library behavior)
 * - Form-level validation is tested in ResumeForm.test.tsx
 * - These tests added no coverage for business logic
 */
describe('resumeMutationSchema', () => {
  const baseInput = {
    education: [],
    personalInfo: {
      email: 'test@example.com',
      linkedin: '',
      location: '',
      name: 'Test User',
      phone: '',
    },
    skills: '',
    summary: '',
    workExperience: [],
    workosUserId: 'user_123',
  }

  test('extends form schema with workosUserId', () => {
    const result = resumeMutationSchema.parse(baseInput)
    expect(result.workosUserId).toBe('user_123')
  })

  test('requires workosUserId to be non-empty', () => {
    expect(() =>
      resumeMutationSchema.parse({
        ...baseInput,
        workosUserId: '',
      }),
    ).toThrow()
  })
})

describe('createDefaultResumeFormValues', () => {
  test('creates empty form with default values from user data', () => {
    let idCounter = 0
    const generateId = () => `id_${++idCounter}`

    const defaults = createDefaultResumeFormValues({
      email: 'test@example.com',
      firstName: 'Test',
      generateId,
      lastName: 'User',
    })

    expect(defaults.personalInfo.name).toBe('Test User')
    expect(defaults.personalInfo.email).toBe('test@example.com')
    expect(defaults.education).toHaveLength(1)
    expect(defaults.education[0].id).toBe('id_1')
    expect(defaults.workExperience).toHaveLength(1)
    expect(defaults.workExperience[0].id).toBe('id_2')
  })

  test('uses existing resume data when provided', () => {
    const existingResume = {
      education: [
        {
          degree: 'BS',
          description: 'Old edu desc',
          field: 'CS',
          graduationDate: '2019-05',
          id: 'existing_edu',
          institution: 'Old University',
        },
      ],
      personalInfo: {
        email: 'existing@example.com',
        linkedin: 'https://linkedin.com/in/existing',
        location: 'NYC',
        name: 'Existing User',
        phone: '555-1234',
      },
      skills: 'Existing skills',
      summary: 'Existing summary',
      workExperience: [
        {
          achievements: 'Old achievements',
          company: 'Old Corp',
          description: 'Old desc',
          endDate: '2023-01',
          id: 'existing_exp',
          position: 'Old Position',
          startDate: '2020-01',
        },
      ],
    }

    const defaults = createDefaultResumeFormValues({
      existingResume,
      generateId: () => 'unused',
    })

    expect(defaults.personalInfo.name).toBe('Existing User')
    expect(defaults.personalInfo.email).toBe('existing@example.com')
    expect(defaults.summary).toBe('Existing summary')
    expect(defaults.skills).toBe('Existing skills')
    expect(defaults.workExperience[0].company).toBe('Old Corp')
    expect(defaults.education[0].institution).toBe('Old University')
  })

  test('preserves empty email from existingResume when provided', () => {
    const existingResume = {
      education: [],
      personalInfo: {
        email: '',
        linkedin: undefined,
        location: undefined,
        name: 'Existing User',
        phone: undefined,
      },
      skills: undefined,
      summary: undefined,
      workExperience: [],
    }

    let idCounter = 0
    const defaults = createDefaultResumeFormValues({
      email: 'fallback@example.com',
      existingResume,
      generateId: () => `id_${++idCounter}`,
    })

    expect(defaults.personalInfo.email).toBe('')
  })

  test('generates empty work experience and education if existingResume has none', () => {
    const existingResume = {
      education: [],
      personalInfo: {
        email: 'test@example.com',
        linkedin: undefined,
        location: undefined,
        name: 'User',
        phone: undefined,
      },
      skills: undefined,
      summary: undefined,
      workExperience: [],
    }

    let idCounter = 0
    const defaults = createDefaultResumeFormValues({
      existingResume,
      generateId: () => `id_${++idCounter}`,
    })

    expect(defaults.education).toHaveLength(1)
    expect(defaults.education[0].id).toBe('id_1')
    expect(defaults.workExperience).toHaveLength(1)
    expect(defaults.workExperience[0].id).toBe('id_2')
  })
})

describe('createEmptyWorkExperience', () => {
  test('creates work experience with given id and empty fields', () => {
    const entry = createEmptyWorkExperience('test_id_123')

    expect(entry.id).toBe('test_id_123')
    expect(entry.company).toBe('')
    expect(entry.position).toBe('')
    expect(entry.startDate).toBe('')
    expect(entry.endDate).toBe('')
    expect(entry.description).toBe('')
    expect(entry.achievements).toBe('')
  })
})

describe('createEmptyEducation', () => {
  test('creates education with given id and empty fields', () => {
    const entry = createEmptyEducation('test_edu_456')

    expect(entry.id).toBe('test_edu_456')
    expect(entry.institution).toBe('')
    expect(entry.degree).toBe('')
    expect(entry.field).toBe('')
    expect(entry.graduationDate).toBe('')
    expect(entry.description).toBe('')
  })
})
