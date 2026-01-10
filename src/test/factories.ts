/**
 * Test data factories with sensible defaults.
 *
 * Usage:
 * - Call factory with no args for defaults: createUser()
 * - Override specific fields: createUser({ firstName: 'Jane' })
 * - Factories use spread, so nested objects need full replacement or manual merge
 */

import type { Doc, Id } from '../../convex/_generated/dataModel'
import type { ParsedJob } from '../../convex/lib/jobSchema'
import type { ProfileFormData } from '@/lib/schemas/profile'
import type { ResumeFormData } from '@/lib/schemas/resume'

// ============================================================================
// WorkOS User Factories (for auth mocks)
// ============================================================================

/** Minimal user shape used across most components */
export interface TestUser {
  email: string
  firstName: string
  id: string
  lastName: string
}

/** Full WorkOS User shape (for ProfileForm which expects full user object) */
export interface FullTestUser extends TestUser {
  createdAt: string
  emailVerified: boolean
  lastActiveAt: string
  lastSignInAt: string
  object: 'user'
  profilePictureUrl: string | null
  updatedAt: string
}

export function createUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    email: 'test@example.com',
    firstName: 'Test',
    id: 'user_test123',
    lastName: 'User',
    ...overrides,
  }
}

export function createFullUser(overrides: Partial<FullTestUser> = {}): FullTestUser {
  const now = new Date().toISOString()
  return {
    createdAt: now,
    email: 'test@example.com',
    emailVerified: true,
    firstName: 'Test',
    id: 'user_test123',
    lastActiveAt: now,
    lastSignInAt: now,
    lastName: 'User',
    object: 'user',
    profilePictureUrl: null,
    updatedAt: now,
    ...overrides,
  }
}

// ============================================================================
// Profile Factories
// ============================================================================

type ProfileDoc = Doc<'profiles'>

export function createProfile(overrides: Partial<ProfileDoc> = {}): ProfileDoc {
  const now = Date.now()
  return {
    _creationTime: now,
    _id: 'profile_123' as Id<'profiles'>,
    bio: 'Experienced developer',
    createdAt: now,
    email: 'test@example.com',
    firstName: 'Test',
    headline: 'Software Engineer',
    lastName: 'User',
    thingsICanOffer: ['To find a job'],
    updatedAt: now,
    workosUserId: 'user_test123',
    ...overrides,
  } as ProfileDoc
}

/** Profile form input factory (for schema tests) */
export function createProfileInput(overrides: Partial<ProfileFormData> = {}): ProfileFormData {
  return {
    bio: 'Summary',
    headline: 'Manager',
    instagramUrl: '',
    linkedinUrl: '',
    location: '',
    resumeLink: '',
    thingsICanOffer: ['To find a job'],
    website: '',
    ...overrides,
  }
}

// ============================================================================
// Resume Factories
// ============================================================================

type ResumeDoc = Doc<'resumes'>

export function createResume(overrides: Partial<ResumeDoc> = {}): ResumeDoc {
  const now = Date.now()
  return {
    _creationTime: now,
    _id: 'resume_123' as Id<'resumes'>,
    createdAt: now,
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
      linkedin: 'https://linkedin.com/in/test',
      location: 'Miami, FL',
      name: 'Test User',
      phone: '555-1234',
    },
    skills: 'JavaScript, TypeScript, React',
    summary: 'Experienced professional',
    updatedAt: now,
    workExperience: [
      {
        achievements: 'Did things',
        company: 'Acme Corp',
        description: 'Built stuff',
        endDate: '2023-12',
        id: 'exp_1',
        position: 'Developer',
        startDate: '2020-01',
      },
    ],
    workosUserId: 'user_test123',
    ...overrides,
  } as ResumeDoc
}

/** Resume form input factory (for form tests) */
export function createResumeInput(overrides: Partial<ResumeFormData> = {}): ResumeFormData {
  return {
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
    ...overrides,
  }
}

// ============================================================================
// Job Preferences Factory
// ============================================================================

type JobPreferencesDoc = Doc<'jobPreferences'>

export function createJobPreferences(
  overrides: Partial<JobPreferencesDoc> = {},
): JobPreferencesDoc {
  const now = Date.now()
  return {
    _creationTime: now,
    _id: 'prefs_123' as Id<'jobPreferences'>,
    maxCommuteMinutes: 30,
    preferEasyApply: true,
    preferSecondChance: false,
    preferUrgent: false,
    requireBusAccessible: false,
    requirePublicTransit: false,
    requireRailAccessible: false,
    requireSecondChance: false,
    shiftAfternoon: false,
    shiftEvening: false,
    shiftFlexible: true,
    shiftMorning: true,
    shiftOvernight: false,
    updatedAt: now,
    workosUserId: 'user_test123',
    ...overrides,
  } as JobPreferencesDoc
}

// ============================================================================
// Sender Factory
// ============================================================================

type SenderDoc = Doc<'senders'>

export function createSender(overrides: Partial<SenderDoc> = {}): SenderDoc {
  const now = Date.now()
  return {
    _creationTime: now,
    _id: 'sender_123' as Id<'senders'>,
    company: 'Acme Corp',
    createdAt: now,
    email: 'employer@example.com',
    name: 'John Employer',
    phone: '+15551234567',
    status: 'approved',
    updatedAt: now,
    ...overrides,
  } as SenderDoc
}

// ============================================================================
// Parsed Job Factory (for AI-parsed job data)
// ============================================================================

export function createParsedJob(overrides: Partial<ParsedJob> = {}): ParsedJob {
  return {
    company: { name: 'Tech Corp' },
    contact: {
      email: 'hr@techcorp.com',
      method: 'email',
      name: 'HR Manager',
      phone: '+15559876543',
    },
    description: 'Build great software',
    employmentType: 'full-time',
    location: { city: 'Miami', state: 'FL' },
    requirements: ['3+ years experience', 'CS degree preferred'],
    salary: { max: 120000, min: 80000, unit: 'year' },
    skills: ['JavaScript', 'TypeScript', 'React'],
    title: 'Software Engineer',
    workArrangement: 'remote',
    ...overrides,
  }
}

// ============================================================================
// Job Submission Factory
// ============================================================================

type JobSubmissionDoc = Doc<'jobSubmissions'>

/** Extended job submission with joined sender data (as returned by queries) */
export type JobSubmissionWithSender = JobSubmissionDoc & {
  sender: {
    _id: Id<'senders'>
    phone?: string
    email?: string
    name?: string
    company?: string
    status: string
  } | null
}

export function createJobSubmission(
  overrides: Partial<JobSubmissionWithSender> = {},
): JobSubmissionWithSender {
  const now = Date.now()
  const defaultSender = createSender()

  return {
    _creationTime: now,
    _id: 'job_123' as Id<'jobSubmissions'>,
    createdAt: now,
    parsedJob: createParsedJob(),
    rawContent: 'Looking for a software engineer...',
    sender: {
      _id: defaultSender._id,
      company: defaultSender.company,
      email: defaultSender.email,
      name: defaultSender.name,
      phone: defaultSender.phone,
      status: defaultSender.status,
    },
    senderId: 'sender_123' as Id<'senders'>,
    source: 'sms',
    status: 'pending_approval',
    ...overrides,
  } as JobSubmissionWithSender
}

// ============================================================================
// Employer Factory
// ============================================================================

type EmployerDoc = Doc<'employers'>

export function createEmployer(overrides: Partial<EmployerDoc> = {}): EmployerDoc {
  const now = Date.now()
  return {
    _creationTime: now,
    _id: 'employer_123' as Id<'employers'>,
    company: 'Tech Corp',
    createdAt: now,
    email: 'employer@techcorp.com',
    name: 'Jane Employer',
    phone: '+15551234567',
    senderId: 'sender_123' as Id<'senders'>,
    status: 'pending_review',
    ...overrides,
  } as EmployerDoc
}

// ============================================================================
// Application Factory
// ============================================================================

type ApplicationDoc = Doc<'applications'>

export function createApplication(overrides: Partial<ApplicationDoc> = {}): ApplicationDoc {
  const now = Date.now()
  return {
    _creationTime: now,
    _id: 'app_123' as Id<'applications'>,
    appliedAt: now,
    jobSubmissionId: 'job_123' as Id<'jobSubmissions'>,
    message: 'I am interested in this position.',
    seekerProfileId: 'profile_123' as Id<'profiles'>,
    status: 'pending',
    ...overrides,
  } as ApplicationDoc
}

// ============================================================================
// ID Helpers (for type-safe ID creation in tests)
// ============================================================================

/** Create a type-safe mock ID for any table */
export function mockId<T extends string>(table: T, value = '123'): Id<T> {
  return `${table.slice(0, -1)}_${value}` as Id<T>
}
