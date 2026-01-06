'use client'

import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'

import { api } from '../../../../convex/_generated/api'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Textarea } from '../../ui/textarea'

interface PromptEditorProps {
  isDirty: boolean
  onClear: () => void
  onChange: (value: string) => void
  value: string | null
}

export function PromptEditor({ isDirty, onClear, onChange, value }: PromptEditorProps) {
  const { data: defaultInstructions } = useQuery(
    convexQuery(api.jobMatcher.admin.getDefaultInstructions, {}),
  )

  const displayValue = value ?? defaultInstructions ?? ''

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  return (
    <div className='flex flex-col h-full'>
      <div className='flex items-center justify-between px-2 py-1 border-b'>
        <div className='flex items-center gap-2'>
          <span className='text-xs font-medium'>Prompt</span>
          {isDirty && (
            <Badge className='text-[10px] px-1 py-0' variant='secondary'>
              Modified
            </Badge>
          )}
        </div>
        {isDirty && (
          <Button className='h-6 text-xs gap-1' onClick={onClear} size='sm' variant='ghost'>
            <RotateCcw className='h-3 w-3' />
            Reset
          </Button>
        )}
      </div>
      <Textarea
        className='flex-1 resize-none text-xs font-mono border-0 rounded-none focus-visible:ring-0'
        onChange={handleChange}
        placeholder='Loading default instructions...'
        value={displayValue}
      />
    </div>
  )
}
