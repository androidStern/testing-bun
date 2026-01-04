'use client'

import { Check, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { Button } from '../../ui/button'

export interface OptionItem {
  id: string
  label: string
  description?: string
}

export interface OptionListProps {
  question: string
  options: Array<OptionItem>
  selectionMode?: 'single' | 'multi'
  onConfirm?: (selection: Array<string>) => void
  onCancel?: () => void
  confirmed?: Array<string>
  allowFreeText?: boolean
  className?: string
}

export function OptionList({
  question,
  options,
  selectionMode = 'single',
  onConfirm,
  onCancel,
  confirmed,
  allowFreeText = true,
  className,
}: OptionListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)
  const isConfirmed = confirmed !== undefined
  const isPending = pendingId !== null && !isConfirmed

  const handleSelect = (id: string) => {
    if (isConfirmed || isPending) return

    if (selectionMode === 'single') {
      setPendingId(id)
      onConfirm?.([id])
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    }
  }

  const handleConfirm = () => {
    if (selected.size > 0) {
      onConfirm?.(Array.from(selected))
    }
  }

  if (isConfirmed) {
    const confirmedOptions = options.filter(opt => confirmed.includes(opt.id))
    return (
      <div className={cn('mb-4 border bg-muted/30 p-4', className)}>
        <p className='text-sm text-muted-foreground mb-2'>{question}</p>
        <div className='flex flex-wrap gap-2'>
          {confirmedOptions.map(opt => (
            <div
              className='inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary'
              key={opt.id}
            >
              <Check className='h-3.5 w-3.5' />
              {opt.label}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isPending) {
    const pendingOption = options.find(opt => opt.id === pendingId)
    return (
      <div className={cn('mb-4 border bg-muted/30 p-4', className)}>
        <p className='text-sm text-muted-foreground mb-2'>{question}</p>
        <div className='flex flex-wrap gap-2'>
          {pendingOption && (
            <div className='inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary'>
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
              {pendingOption.label}
            </div>
          )}
        </div>
        <p className='mt-3 text-xs text-muted-foreground flex items-center gap-1.5'>
          <span className='inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse' />
          Processing your selection...
        </p>
      </div>
    )
  }

  return (
    <div className={cn('mb-4 border bg-card p-4', className)}>
      <p className='text-sm font-medium mb-3'>{question}</p>

      <div
        aria-multiselectable={selectionMode === 'multi'}
        className='flex flex-wrap gap-2'
        role='listbox'
      >
        {options.map(opt => {
          const isSelected = selected.has(opt.id)
          return (
            <button
              aria-selected={isSelected}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected &&
                  'bg-primary text-primary-foreground border-primary hover:bg-primary/90',
                !isSelected && 'bg-background',
              )}
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              role='option'
              type='button'
            >
              {selectionMode === 'multi' && isSelected && <Check className='h-3.5 w-3.5' />}
              {opt.label}
            </button>
          )
        })}
      </div>

      {selectionMode === 'single' && options.some(o => o.description) && (
        <div className='mt-2 text-xs text-muted-foreground'>Click an option to select</div>
      )}

      {selectionMode === 'multi' && (
        <div className='flex items-center gap-2 mt-4 pt-3 border-t'>
          <Button disabled={selected.size === 0} onClick={handleConfirm} size='sm'>
            Confirm ({selected.size})
          </Button>
          {onCancel && (
            <Button onClick={onCancel} size='sm' variant='ghost'>
              Cancel
            </Button>
          )}
        </div>
      )}

      {allowFreeText && (
        <p className='mt-3 text-xs text-muted-foreground'>Or type your own answer below</p>
      )}
    </div>
  )
}
