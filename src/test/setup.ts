import { vi } from 'vitest'

export const mockConvexQuery = vi.fn()
export const mockConvexMutation = vi.fn()
export const mockConvexAction = vi.fn()

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (...args: unknown[]) => {
    mockConvexQuery(...args)
    return { queryFn: vi.fn(), queryKey: ['mock'] }
  },
  useConvexMutation: () => mockConvexMutation,
}))

vi.mock('convex/react', () => ({
  useAction: () => mockConvexAction,
  useMutation: () => mockConvexMutation,
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useMutation: vi.fn(() => ({
      error: null,
      isError: false,
      isPending: false,
      mutate: mockConvexMutation,
      mutateAsync: mockConvexMutation,
    })),
    useQuery: vi.fn(() => ({
      data: null,
      error: null,
      isLoading: false,
    })),
    useSuspenseQuery: vi.fn(() => ({
      data: null,
      error: null,
      isLoading: false,
    })),
  }
})

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  const React = await import('react')
  return {
    ...actual,
    Link: ({ children, ...props }: { children: React.ReactNode; to: string }) =>
      React.createElement('a', { href: props.to }, children),
    useBlocker: vi.fn(() => ({})),
  }
})

vi.mock('@workos/authkit-tanstack-react-start/client', () => ({
  useAuth: () => ({
    error: null,
    isLoading: false,
    user: {
      email: 'test@example.com',
      firstName: 'Test',
      id: 'user_test123',
      lastName: 'User',
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}))

export const mockUser = {
  email: 'test@example.com',
  firstName: 'Test',
  id: 'user_test123',
  lastName: 'User',
}

export const mockExistingProfile = {
  _creationTime: Date.now(),
  _id: 'profile_123' as const,
  bio: 'Experienced developer',
  email: 'test@example.com',
  firstName: 'Test',
  headline: 'Software Engineer',
  instagramUrl: '',
  lastName: 'User',
  linkedinUrl: 'https://linkedin.com/in/test',
  location: 'Miami, FL',
  resumeLink: '',
  thingsICanOffer: ['To find a job'],
  website: 'https://example.com',
  workosUserId: 'user_test123',
}

export const mockExistingResume = {
  _creationTime: Date.now(),
  _id: 'resume_123' as const,
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
}

export const mockJobPreferences = {
  _creationTime: Date.now(),
  _id: 'prefs_123' as const,
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
  workosUserId: 'user_test123',
}

export function resetAllMocks() {
  mockConvexQuery.mockClear()
  mockConvexMutation.mockClear()
  mockConvexAction.mockClear()
}
