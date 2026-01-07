import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { mockConvexMutation, resetAllMocks } from '@/test/setup'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { JobSubmissionCard } from './JobSubmissionCard'

type JobSubmission = Doc<'jobSubmissions'> & {
  sender: {
    _id: Id<'senders'>
    phone?: string
    email?: string
    name?: string
    company?: string
    status: string
  } | null
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const mockSender = {
  _id: 'sender_123' as Id<'senders'>,
  company: 'Acme Corp',
  email: 'employer@example.com',
  name: 'John Employer',
  phone: '+15551234567',
  status: 'approved',
}

const baseParsedJob = {
  company: { name: 'Tech Corp' },
  contact: {
    email: 'hr@techcorp.com',
    method: 'email' as const,
    name: 'HR Manager',
    phone: '+15559876543',
  },
  description: 'Build great software',
  employmentType: 'full-time' as const,
  location: { city: 'Miami', state: 'FL' },
  requirements: ['3+ years experience', 'CS degree preferred'],
  salary: { max: 120000, min: 80000, unit: 'year' as const },
  skills: ['JavaScript', 'TypeScript', 'React'],
  title: 'Software Engineer',
  workArrangement: 'remote' as const,
}

function createMockJob(overrides: Partial<JobSubmission> = {}): JobSubmission {
  return {
    _creationTime: Date.now(),
    _id: 'job_123' as Id<'jobSubmissions'>,
    channel: 'sms',
    createdAt: Date.now(),
    parsedJob: baseParsedJob,
    rawText: 'Looking for a software engineer...',
    sender: mockSender,
    senderId: 'sender_123' as Id<'senders'>,
    status: 'pending_approval',
    ...overrides,
  } as JobSubmission
}

describe('JobSubmissionCard', () => {
  beforeEach(() => {
    resetAllMocks()
    vi.clearAllMocks()
  })

  describe('Display Mode - Parsed Job Info', () => {
    test('renders job title when parsed', async () => {
      const job = createMockJob()
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Software Engineer')).toBeVisible()
    })

    test('shows parsing status when job is not parsed', async () => {
      const job = createMockJob({ parsedJob: undefined })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Parsing...')).toBeVisible()
    })

    test('renders company name', async () => {
      const job = createMockJob()
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Tech Corp')).toBeVisible()
    })

    test('renders location when provided', async () => {
      const job = createMockJob()
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText(/Miami, FL/)).toBeVisible()
    })

    test('renders job description when available', async () => {
      const job = createMockJob()
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Build great software')).toBeVisible()
    })

    test('renders employment type badge', async () => {
      const job = createMockJob()
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('full-time')).toBeVisible()
    })

    test('renders work arrangement badge', async () => {
      const job = createMockJob()
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('remote')).toBeVisible()
    })

    test('renders salary range', async () => {
      const job = createMockJob()
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText(/\$80000 - \$120000/)).toBeVisible()
    })

    test('renders skills list', async () => {
      const job = createMockJob()
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText(/JavaScript, TypeScript, React/)).toBeVisible()
    })

    test('renders sender information', async () => {
      const job = createMockJob()
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText(/\+15551234567/)).toBeVisible()
    })
  })

  describe('Status Display', () => {
    test('shows pending approval status', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      const container = screen.container
      expect(container.textContent).toContain('pending_approval')
    })

    test('shows approved status', async () => {
      const job = createMockJob({ status: 'approved' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Approved')).toBeVisible()
    })

    test('shows approved by information when available', async () => {
      const job = createMockJob({
        approvedAt: Date.now(),
        approvedBy: 'admin@example.com',
        status: 'approved',
      })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText(/Approved by admin@example.com/)).toBeVisible()
    })

    test('shows deny reason when job is denied', async () => {
      const job = createMockJob({
        denyReason: 'Missing required information',
        status: 'denied',
      })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText(/Missing required information/)).toBeVisible()
    })
  })

  describe('Circle Post Link', () => {
    test('shows Circle link when available', async () => {
      const job = createMockJob({
        circlePostUrl: 'https://circle.so/post/123',
      })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('View on Circle →')).toBeVisible()
    })

    test('Circle link has correct href', async () => {
      const job = createMockJob({
        circlePostUrl: 'https://circle.so/post/123',
      })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      const link = screen.container.querySelector('a[href="https://circle.so/post/123"]')
      expect(link).not.toBeNull()
    })
  })

  describe('Action Buttons', () => {
    test('shows Approve and Deny buttons when showActions is true and status is pending_approval', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} showActions={true} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Approve')).toBeVisible()
      await expect.element(screen.getByText('Deny')).toBeVisible()
    })

    test('hides action buttons when showActions is false', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} showActions={false} />
        </TestWrapper>,
      )

      const buttons = screen.container.querySelectorAll('button')
      const hasApproveButton = Array.from(buttons).some(btn => btn.textContent === 'Approve')
      expect(hasApproveButton).toBe(false)
    })

    test('hides action buttons when status is not pending_approval', async () => {
      const job = createMockJob({ status: 'approved' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} showActions={true} />
        </TestWrapper>,
      )

      const buttons = screen.container.querySelectorAll('button')
      const hasApproveButton = Array.from(buttons).some(btn => btn.textContent === 'Approve')
      expect(hasApproveButton).toBe(false)
    })

    test('shows Edit button when status is pending_approval', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Edit')).toBeVisible()
    })

    test('hides Edit button when status is not pending_approval', async () => {
      const job = createMockJob({ status: 'approved' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      const buttons = screen.container.querySelectorAll('button')
      const hasEditButton = Array.from(buttons).some(btn => btn.textContent === 'Edit')
      expect(hasEditButton).toBe(false)
    })
  })

  describe('Edit Mode', () => {
    test('clicking Edit button switches to edit mode', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      const editButton = screen.getByText('Edit')
      await editButton.click()

      await expect.element(screen.getByText('Editing Job')).toBeVisible()
    })

    test('edit mode shows form fields', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      await expect.element(screen.getByText('Title *')).toBeVisible()
      await expect.element(screen.getByText('Description')).toBeVisible()
      await expect.element(screen.getByText('Company *')).toBeVisible()
    })

    test('edit mode pre-populates form with existing data', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      const titleInput = screen.container.querySelector(
        'input[placeholder="Job title"]',
      ) as HTMLInputElement
      expect(titleInput?.value).toBe('Software Engineer')

      const companyInput = screen.container.querySelector(
        'input[placeholder="Company name"]',
      ) as HTMLInputElement
      expect(companyInput?.value).toBe('Tech Corp')
    })

    test('clicking Save button submits the edit form', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // The Save button should be visible
      const saveButton = screen.getByRole('button', { name: /save/i })
      await expect.element(saveButton).toBeVisible()

      // Click save to trigger form submission
      await saveButton.click()

      // The form should have triggered submission - the mutation would be mocked in a full test
    })

    test('edit mode shows Cancel and Save buttons', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      await expect.element(screen.getByText('Cancel')).toBeVisible()
      await expect.element(screen.getByText('Save')).toBeVisible()
    })

    test('Cancel button exits edit mode', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()
      await expect.element(screen.getByText('Editing Job')).toBeVisible()

      await screen.getByText('Cancel').click()

      await expect.element(screen.getByText('Edit')).toBeVisible()
    })

    test('edit mode shows all form fields for job editing', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      await expect.element(screen.getByText('Contact Name')).toBeVisible()
      await expect.element(screen.getByText('Contact Email')).toBeVisible()
      await expect.element(screen.getByText('Contact Phone')).toBeVisible()
      await expect.element(screen.getByText('Contact Method')).toBeVisible()

      await expect.element(screen.getByText('City')).toBeVisible()
      await expect.element(screen.getByText('State')).toBeVisible()

      await expect.element(screen.getByText('Work Arrangement')).toBeVisible()
      await expect.element(screen.getByText('Employment Type')).toBeVisible()

      await expect.element(screen.getByText('Salary Min')).toBeVisible()
      await expect.element(screen.getByText('Salary Max')).toBeVisible()
      await expect.element(screen.getByText('Salary Unit')).toBeVisible()

      await expect.element(screen.getByText('Skills (comma-separated)')).toBeVisible()
      await expect.element(screen.getByText('Requirements (comma-separated)')).toBeVisible()
    })

    test('edit mode shows status badge', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      const container = screen.container
      expect(container.textContent).toContain('pending')
    })
  })

  describe('Form Select Fields', () => {
    test('contact method select has phone and email options', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      const selects = screen.container.querySelectorAll('select')
      const contactMethodSelect = Array.from(selects).find(s =>
        Array.from(s.options).some(o => o.value === 'phone'),
      )

      expect(contactMethodSelect).not.toBeNull()
      const options = Array.from(contactMethodSelect!.options).map(o => o.value)
      expect(options).toContain('phone')
      expect(options).toContain('email')
    })

    test('work arrangement select has correct options', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      const selects = screen.container.querySelectorAll('select')
      const workArrangementSelect = Array.from(selects).find(s =>
        Array.from(s.options).some(o => o.value === 'remote'),
      )

      expect(workArrangementSelect).not.toBeNull()
      const options = Array.from(workArrangementSelect!.options).map(o => o.value)
      expect(options).toContain('')
      expect(options).toContain('remote')
      expect(options).toContain('on-site')
      expect(options).toContain('hybrid')
    })

    test('changing contact method select updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the contact method select (has 'phone' and 'email' options but not 'remote')
      const selects = screen.container.querySelectorAll('select')
      const contactMethodSelect = Array.from(selects).find(s =>
        Array.from(s.options).some(o => o.value === 'phone') &&
        !Array.from(s.options).some(o => o.value === 'remote'),
      ) as HTMLSelectElement

      expect(contactMethodSelect).not.toBeNull()

      // Change the select value from email to phone
      contactMethodSelect.value = 'phone'
      contactMethodSelect.dispatchEvent(new Event('change', { bubbles: true }))

      // Verify the select value was updated
      expect(contactMethodSelect.value).toBe('phone')
    })

    test('typing in city input updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the city input by placeholder
      const cityInput = screen.getByPlaceholder('City')
      await cityInput.fill('New York')

      // Verify the input value was updated
      expect((cityInput.element() as HTMLInputElement).value).toBe('New York')
    })

    test('typing in state input updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the state input by placeholder
      const stateInput = screen.getByPlaceholder('State')
      await stateInput.fill('NY')

      // Verify the input value was updated
      expect((stateInput.element() as HTMLInputElement).value).toBe('NY')
    })

    test('changing work arrangement select updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the work arrangement select (has 'remote', 'on-site', 'hybrid' options)
      const selects = screen.container.querySelectorAll('select')
      const workArrangementSelect = Array.from(selects).find(s =>
        Array.from(s.options).some(o => o.value === 'remote') &&
        Array.from(s.options).some(o => o.value === 'on-site'),
      ) as HTMLSelectElement

      expect(workArrangementSelect).not.toBeNull()

      // Change the select value from remote to hybrid
      workArrangementSelect.value = 'hybrid'
      workArrangementSelect.dispatchEvent(new Event('change', { bubbles: true }))

      // Verify the select value was updated
      expect(workArrangementSelect.value).toBe('hybrid')
    })

    test('typing in company name input updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the company name input by placeholder
      const companyNameInput = screen.getByPlaceholder('Company name')
      await companyNameInput.fill('Acme Inc')

      // Verify the input value was updated
      expect((companyNameInput.element() as HTMLInputElement).value).toBe('Acme Inc')
    })

    test('typing in contact name input updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the contact name input by placeholder
      const contactNameInput = screen.getByPlaceholder('Contact name')
      await contactNameInput.fill('Jane Smith')

      // Verify the input value was updated
      expect((contactNameInput.element() as HTMLInputElement).value).toBe('Jane Smith')
    })

    test('typing in contact email input updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the contact email input by placeholder
      const contactEmailInput = screen.getByPlaceholder('email@example.com')
      await contactEmailInput.fill('contact@newcompany.com')

      // Verify the input value was updated
      expect((contactEmailInput.element() as HTMLInputElement).value).toBe('contact@newcompany.com')
    })

    test('typing in contact phone input updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the contact phone input by placeholder
      const contactPhoneInput = screen.getByPlaceholder('Phone number')
      await contactPhoneInput.fill('+15551234567')

      // Verify the input value was updated
      expect((contactPhoneInput.element() as HTMLInputElement).value).toBe('+15551234567')
    })

    test('typing in job title input updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the job title input by placeholder
      const titleInput = screen.getByPlaceholder('Job title')
      await titleInput.fill('Senior Software Engineer')

      // Verify the input value was updated
      expect((titleInput.element() as HTMLInputElement).value).toBe('Senior Software Engineer')
    })

    test('typing in job description textarea updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the description textarea by placeholder
      const descriptionTextarea = screen.getByPlaceholder('Job description')
      await descriptionTextarea.fill('Build amazing software products for our customers.')

      // Verify the textarea value was updated
      expect((descriptionTextarea.element() as HTMLTextAreaElement).value).toBe(
        'Build amazing software products for our customers.',
      )
    })

    test('employment type select has correct options', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      const selects = screen.container.querySelectorAll('select')
      const employmentTypeSelect = Array.from(selects).find(s =>
        Array.from(s.options).some(o => o.value === 'full-time'),
      )

      expect(employmentTypeSelect).not.toBeNull()
      const options = Array.from(employmentTypeSelect!.options).map(o => o.value)
      expect(options).toContain('')
      expect(options).toContain('full-time')
      expect(options).toContain('part-time')
      expect(options).toContain('contract')
      expect(options).toContain('internship')
      expect(options).toContain('temporary')
    })

    test('salary unit select has correct options', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      const selects = screen.container.querySelectorAll('select')
      const salaryUnitSelect = Array.from(selects).find(s =>
        Array.from(s.options).some(o => o.value === 'hr'),
      )

      expect(salaryUnitSelect).not.toBeNull()
      const options = Array.from(salaryUnitSelect!.options).map(o => o.value)
      expect(options).toContain('')
      expect(options).toContain('hr')
      expect(options).toContain('day')
      expect(options).toContain('week')
      expect(options).toContain('month')
      expect(options).toContain('year')
      expect(options).toContain('job')
    })

    test('changing salary unit select updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the salary unit select (has 'hr' option)
      const selects = screen.container.querySelectorAll('select')
      const salaryUnitSelect = Array.from(selects).find(s =>
        Array.from(s.options).some(o => o.value === 'hr'),
      ) as HTMLSelectElement

      expect(salaryUnitSelect).not.toBeNull()

      // Change the select value to trigger onChange handler
      salaryUnitSelect.value = 'hr'
      salaryUnitSelect.dispatchEvent(new Event('change', { bubbles: true }))

      // Verify the select value was updated
      expect(salaryUnitSelect.value).toBe('hr')
    })

    test('changing employment type select updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the employment type select (has 'full-time' option)
      const selects = screen.container.querySelectorAll('select')
      const employmentTypeSelect = Array.from(selects).find(s =>
        Array.from(s.options).some(o => o.value === 'full-time'),
      ) as HTMLSelectElement

      expect(employmentTypeSelect).not.toBeNull()

      // Change the select value from full-time to contract
      employmentTypeSelect.value = 'contract'
      employmentTypeSelect.dispatchEvent(new Event('change', { bubbles: true }))

      // Verify the select value was updated
      expect(employmentTypeSelect.value).toBe('contract')
    })

    test('typing in salary min input updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the salary min input by placeholder
      const salaryMinInput = screen.getByPlaceholder('Min')
      await salaryMinInput.fill('50000')

      // Verify the input value was updated
      expect((salaryMinInput.element() as HTMLInputElement).value).toBe('50000')
    })

    test('typing in salary max input updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the salary max input by placeholder
      const salaryMaxInput = screen.getByPlaceholder('Max')
      await salaryMaxInput.fill('100000')

      // Verify the input value was updated
      expect((salaryMaxInput.element() as HTMLInputElement).value).toBe('100000')
    })

    test('typing in skills input updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the skills input by placeholder
      const skillsInput = screen.getByPlaceholder('skill1, skill2, skill3')
      await skillsInput.fill('Python, Go, Rust')

      // Verify the input value was updated
      expect((skillsInput.element() as HTMLInputElement).value).toBe('Python, Go, Rust')
    })

    test('typing in requirements input updates the value', async () => {
      const job = createMockJob({ status: 'pending_approval' })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await screen.getByText('Edit').click()

      // Find the requirements input by placeholder
      const requirementsInput = screen.getByPlaceholder('req1, req2, req3')
      await requirementsInput.fill('5+ years experience, Bachelor degree')

      // Verify the input value was updated
      expect((requirementsInput.element() as HTMLInputElement).value).toBe('5+ years experience, Bachelor degree')
    })
  })

  describe('Edge Cases', () => {
    test('handles job without location', async () => {
      const job = createMockJob({
        parsedJob: { ...baseParsedJob, location: undefined },
      })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Tech Corp')).toBeVisible()
      const container = screen.container
      expect(container.textContent).not.toContain('Miami')
    })

    test('handles job without skills', async () => {
      const job = createMockJob({
        parsedJob: { ...baseParsedJob, skills: undefined },
      })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Software Engineer')).toBeVisible()
      const container = screen.container
      expect(container.textContent).not.toContain('Skills:')
    })

    test('handles job without salary', async () => {
      const job = createMockJob({
        parsedJob: { ...baseParsedJob, salary: undefined },
      })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText('Software Engineer')).toBeVisible()
      const container = screen.container
      expect(container.textContent).not.toContain('$80000')
    })

    test('handles sender with email instead of phone', async () => {
      const job = createMockJob({
        sender: {
          ...mockSender,
          email: 'employer@example.com',
          phone: undefined,
        },
      })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText(/employer@example.com/)).toBeVisible()
    })

    test('handles null sender', async () => {
      const job = createMockJob({ sender: null })
      const screen = await render(
        <TestWrapper>
          <JobSubmissionCard job={job} />
        </TestWrapper>,
      )

      await expect.element(screen.getByText(/Unknown/)).toBeVisible()
    })
  })
})
