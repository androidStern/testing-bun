import { describe, expect, test } from 'vitest'
import {
  createDefaultResumeFormValues,
  createEmptyEducation,
  createEmptyWorkExperience,
  resumeFormSchema,
  resumeMutationSchema,
} from './resume'

describe('resumeFormSchema', () => {
  describe('personalInfo validation', () => {
    test('requires name to be non-empty', () => {
      expect(() =>
        resumeFormSchema.parse({
          education: [],
          personalInfo: {
            email: 'test@example.com',
            linkedin: '',
            location: '',
            name: '',
            phone: '',
          },
          skills: '',
          summary: '',
          workExperience: [],
        }),
      ).toThrow()
    })

    test('validates email format', () => {
      expect(() =>
        resumeFormSchema.parse({
          education: [],
          personalInfo: {
            email: 'invalid',
            linkedin: '',
            location: '',
            name: 'Test User',
            phone: '',
          },
          skills: '',
          summary: '',
          workExperience: [],
        }),
      ).toThrow()
    })

    test('accepts valid email', () => {
      const result = resumeFormSchema.parse({
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
      })

      expect(result.personalInfo.email).toBe('test@example.com')
    })

    test('validates linkedin URL format', () => {
      expect(() =>
        resumeFormSchema.parse({
          education: [],
          personalInfo: {
            email: 'test@example.com',
            linkedin: 'not-a-url',
            location: '',
            name: 'Test User',
            phone: '',
          },
          skills: '',
          summary: '',
          workExperience: [],
        }),
      ).toThrow()
    })

    test('accepts valid linkedin URL', () => {
      const result = resumeFormSchema.parse({
        education: [],
        personalInfo: {
          email: 'test@example.com',
          linkedin: 'https://linkedin.com/in/test',
          location: '',
          name: 'Test User',
          phone: '',
        },
        skills: '',
        summary: '',
        workExperience: [],
      })

      expect(result.personalInfo.linkedin).toBe('https://linkedin.com/in/test')
    })

    test('transforms empty optional fields to undefined', () => {
      const result = resumeFormSchema.parse({
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
      })

      expect(result.personalInfo.phone).toBeUndefined()
      expect(result.personalInfo.location).toBeUndefined()
      expect(result.personalInfo.linkedin).toBeUndefined()
    })
  })

  describe('workExperience array transforms', () => {
    test('transforms empty strings in work experience to undefined', () => {
      const result = resumeFormSchema.parse({
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
        workExperience: [
          {
            achievements: '',
            company: '',
            description: '',
            endDate: '',
            id: 'exp_1',
            position: '',
            startDate: '',
          },
        ],
      })

      expect(result.workExperience[0].company).toBeUndefined()
      expect(result.workExperience[0].position).toBeUndefined()
      expect(result.workExperience[0].startDate).toBeUndefined()
      expect(result.workExperience[0].endDate).toBeUndefined()
      expect(result.workExperience[0].description).toBeUndefined()
      expect(result.workExperience[0].achievements).toBeUndefined()
    })

    test('preserves non-empty strings in work experience', () => {
      const result = resumeFormSchema.parse({
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
        workExperience: [
          {
            achievements: 'Did stuff',
            company: 'Acme Corp',
            description: 'Built things',
            endDate: '2023-12',
            id: 'exp_1',
            position: 'Developer',
            startDate: '2020-01',
          },
        ],
      })

      expect(result.workExperience[0].company).toBe('Acme Corp')
      expect(result.workExperience[0].position).toBe('Developer')
      expect(result.workExperience[0].startDate).toBe('2020-01')
      expect(result.workExperience[0].endDate).toBe('2023-12')
    })

    test('preserves id in work experience', () => {
      const result = resumeFormSchema.parse({
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
        workExperience: [
          {
            achievements: '',
            company: '',
            description: '',
            endDate: '',
            id: 'exp_unique_123',
            position: '',
            startDate: '',
          },
        ],
      })

      expect(result.workExperience[0].id).toBe('exp_unique_123')
    })
  })

  describe('education array transforms', () => {
    test('transforms empty strings in education to undefined', () => {
      const result = resumeFormSchema.parse({
        education: [
          {
            degree: '',
            description: '',
            field: '',
            graduationDate: '',
            id: 'edu_1',
            institution: '',
          },
        ],
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
      })

      expect(result.education[0].institution).toBeUndefined()
      expect(result.education[0].degree).toBeUndefined()
      expect(result.education[0].field).toBeUndefined()
      expect(result.education[0].graduationDate).toBeUndefined()
      expect(result.education[0].description).toBeUndefined()
    })

    test('preserves non-empty strings in education', () => {
      const result = resumeFormSchema.parse({
        education: [
          {
            degree: 'BS',
            description: 'Honors',
            field: 'Computer Science',
            graduationDate: '2019-05',
            id: 'edu_1',
            institution: 'State University',
          },
        ],
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
      })

      expect(result.education[0].institution).toBe('State University')
      expect(result.education[0].degree).toBe('BS')
      expect(result.education[0].field).toBe('Computer Science')
    })
  })

  describe('summary and skills transforms', () => {
    test('transforms empty summary to undefined', () => {
      const result = resumeFormSchema.parse({
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
      })

      expect(result.summary).toBeUndefined()
      expect(result.skills).toBeUndefined()
    })

    test('preserves non-empty summary and skills', () => {
      const result = resumeFormSchema.parse({
        education: [],
        personalInfo: {
          email: 'test@example.com',
          linkedin: '',
          location: '',
          name: 'Test User',
          phone: '',
        },
        skills: 'JavaScript, TypeScript, React',
        summary: 'Experienced developer',
        workExperience: [],
      })

      expect(result.summary).toBe('Experienced developer')
      expect(result.skills).toBe('JavaScript, TypeScript, React')
    })
  })
})

describe('resumeMutationSchema', () => {
  test('extends form schema with workosUserId', () => {
    const result = resumeMutationSchema.parse({
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
    })

    expect(result.workosUserId).toBe('user_123')
  })

  test('requires workosUserId to be non-empty', () => {
    expect(() =>
      resumeMutationSchema.parse({
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
