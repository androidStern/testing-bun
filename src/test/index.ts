/**
 * Test utilities barrel export.
 *
 * Usage:
 * import { renderWithProviders, createUser, mockConvexMutation } from '@/test'
 */

// Mocks and mock utilities
export {
  mockConvexQuery,
  mockConvexMutation,
  mockConvexAction,
  mutationCallbacks,
  resetAllMocks,
  // Legacy mock fixtures (prefer factories instead)
  mockUser,
  mockExistingProfile,
  mockExistingResume,
  mockJobPreferences,
} from './setup'

// Render utilities
export { createTestQueryClient, TestWrapper, renderWithProviders } from './render'

// Data factories
export {
  // User factories
  createUser,
  createFullUser,
  type TestUser,
  type FullTestUser,
  // Entity factories
  createProfile,
  createProfileInput,
  createResume,
  createResumeInput,
  createJobPreferences,
  createSender,
  createParsedJob,
  createJobSubmission,
  createEmployer,
  createApplication,
  // Types
  type JobSubmissionWithSender,
  // ID helpers
  mockId,
} from './factories'
