import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { formatZodError, parseWithSchema } from './parse'

describe('formatZodError', () => {
  test('formats error with path and message', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().positive(),
    })

    const result = schema.safeParse({ name: '', age: -5 })
    if (result.success) throw new Error('Expected validation to fail')

    const formatted = formatZodError(result.error)

    // Should include path and validation messages
    expect(formatted).toContain('name:')
    expect(formatted).toContain('age:')
  })
})

describe('parseWithSchema', () => {
  test('returns parsed data when input is valid', () => {
    const schema = z.object({ id: z.string(), count: z.number() })
    const input = { id: 'test-123', count: 5 }

    const result = parseWithSchema(schema, input, 'TestData')

    expect(result).toEqual({ id: 'test-123', count: 5 })
  })

  test('throws error with component name when input is invalid', () => {
    const schema = z.object({ id: z.string() })
    const input = { id: 123 } // wrong type

    expect(() => parseWithSchema(schema, input, 'MyComponent')).toThrow('Invalid MyComponent payload')
  })
})
