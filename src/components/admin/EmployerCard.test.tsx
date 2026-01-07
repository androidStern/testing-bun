import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { resetAllMocks } from '@/test/setup'
import { EmployerCard } from './EmployerCard'
import type { Id } from '../../../convex/_generated/dataModel'

const mockEmployer = {
  _id: 'employer_123' as Id<'employers'>,
  name: 'Jane Recruiter',
  email: 'jane@techcorp.com',
  phone: '+1555123456',
  company: 'Tech Corp',
  role: 'HR Manager',
  website: 'https://techcorp.com',
  status: 'pending_review' as const,
  createdAt: Date.now() - 86400000, // 1 day ago
}

describe('EmployerCard', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Employer Details Display', () => {
    test('displays employer name and company for admin to review', async () => {
      const screen = await render(<EmployerCard employer={mockEmployer} />)

      // Admin should see the employer's key details
      await expect.element(screen.getByText('Jane Recruiter')).toBeVisible()
      await expect.element(screen.getByText('Tech Corp')).toBeVisible()
    })

    test('displays contact information with clickable links', async () => {
      const screen = await render(<EmployerCard employer={mockEmployer} />)

      // Admin should see contact info
      await expect.element(screen.getByText('jane@techcorp.com')).toBeVisible()
      await expect.element(screen.getByText('+1555123456')).toBeVisible()
    })

    test('displays pending_review status badge for new employer applications', async () => {
      const screen = await render(<EmployerCard employer={mockEmployer} />)

      // Admin should see the status
      await expect.element(screen.getByText('pending review')).toBeVisible()
    })
  })

  describe('Action Buttons', () => {
    test('shows Approve and Reject buttons when showActions is true for pending employers', async () => {
      const screen = await render(<EmployerCard employer={mockEmployer} showActions={true} />)

      await expect.element(screen.getByText('Approve')).toBeVisible()
      await expect.element(screen.getByText('Reject')).toBeVisible()
    })

    test('always shows Edit and Delete buttons', async () => {
      const screen = await render(<EmployerCard employer={mockEmployer} />)

      await expect.element(screen.getByText('Edit')).toBeVisible()
      await expect.element(screen.getByText('Delete')).toBeVisible()
    })

    test('clicking Edit button shows editing mode with form fields', async () => {
      const screen = await render(<EmployerCard employer={mockEmployer} />)

      // Click Edit button
      const editButton = screen.getByText('Edit')
      await editButton.click()

      // Admin should see editing UI with form fields
      await expect.element(screen.getByText('Editing')).toBeVisible()
      await expect.element(screen.getByText('Save')).toBeVisible()
      await expect.element(screen.getByText('Cancel')).toBeVisible()
    })
  })
})
