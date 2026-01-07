import { describe, expect, test } from 'vitest'
import { parseSerializablePlan } from './schema'

describe('parseSerializablePlan', () => {
  test('parses valid plan data successfully', () => {
    const validPlan = {
      id: 'plan-123',
      title: 'Job Search Plan',
      todos: [
        { id: 'todo-1', label: 'Search jobs', status: 'pending' },
        { id: 'todo-2', label: 'Apply', status: 'in_progress' },
      ],
    }

    const result = parseSerializablePlan(validPlan)

    expect(result.id).toBe('plan-123')
    expect(result.title).toBe('Job Search Plan')
    expect(result.todos).toHaveLength(2)
    expect(result.todos[0].status).toBe('pending')
  })
})
