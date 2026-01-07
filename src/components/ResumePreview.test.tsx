import { describe, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { ResumePreview } from './ResumePreview'
import type { ResumeFormData } from '@/lib/schemas/resume'

const mockResumeData: ResumeFormData = {
  education: [
    {
      degree: 'Bachelor of Science',
      description: 'Honors graduate',
      field: 'Computer Science',
      graduationDate: '2019-05',
      id: 'edu_1',
      institution: 'State University',
    },
  ],
  personalInfo: {
    email: 'john@example.com',
    linkedin: 'linkedin.com/in/johndoe',
    location: 'Miami, FL',
    name: 'John Doe',
    phone: '555-123-4567',
  },
  skills: 'JavaScript, React, TypeScript',
  summary: 'Experienced software developer with 5 years of experience.',
  workExperience: [
    {
      achievements: 'Improved performance by 50%\nLed team of 5 developers',
      company: 'Tech Corp',
      description: 'Developed web applications.',
      endDate: 'Present',
      id: 'exp_1',
      position: 'Senior Developer',
      startDate: '2020-01',
    },
  ],
}

describe('ResumePreview', () => {
  describe('Resume Data Display', () => {
    test('displays user personal information correctly', async () => {
      const screen = await render(<ResumePreview formData={mockResumeData} />)

      // User should see their name as header
      await expect.element(screen.getByText('John Doe')).toBeVisible()

      // User should see their contact information
      await expect.element(screen.getByText('john@example.com')).toBeVisible()
      await expect.element(screen.getByText('555-123-4567')).toBeVisible()
      await expect.element(screen.getByText('Miami, FL')).toBeVisible()
    })

    test('displays professional summary section', async () => {
      const screen = await render(<ResumePreview formData={mockResumeData} />)

      // User should see professional summary heading and content
      await expect.element(screen.getByText('Professional Summary')).toBeVisible()
      await expect
        .element(screen.getByText('Experienced software developer with 5 years of experience.'))
        .toBeVisible()
    })

    test('displays work experience section', async () => {
      const screen = await render(<ResumePreview formData={mockResumeData} />)

      // User should see work experience heading
      await expect.element(screen.getByText('Work Experience')).toBeVisible()

      // User should see their job details
      await expect.element(screen.getByText('Senior Developer')).toBeVisible()
      await expect.element(screen.getByText('Tech Corp')).toBeVisible()
    })
  })

  describe('ATS Tips Tab', () => {
    test('clicking ATS Tips tab shows optimization tips for job seekers', async () => {
      const screen = await render(<ResumePreview formData={mockResumeData} />)

      // User clicks the ATS Tips tab to learn how to optimize their resume
      const atsTipsTab = screen.getByRole('tab', { name: 'ATS Tips' })
      await atsTipsTab.click()

      // User should see the ATS optimization guidance heading
      await expect.element(screen.getByText('ATS Optimization Tips')).toBeVisible()

      // User should see key tip category headings that help them improve their resume
      await expect.element(screen.getByRole('heading', { name: 'Keywords' })).toBeVisible()
      await expect.element(screen.getByRole('heading', { name: 'Formatting' })).toBeVisible()
      await expect.element(screen.getByRole('heading', { name: 'File Format' })).toBeVisible()
      await expect
        .element(screen.getByRole('heading', { name: 'Quantifiable Achievements' }))
        .toBeVisible()
      await expect
        .element(screen.getByRole('heading', { name: 'Job Title Alignment' }))
        .toBeVisible()
    })
  })
})
