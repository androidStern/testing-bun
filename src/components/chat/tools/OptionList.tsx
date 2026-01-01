'use client'

import { Check } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'

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

/**
 * OptionList component for displaying quick-reply options in chat.
 * Supports single and multi-select modes with confirmation state.
 */
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
  const isConfirmed = confirmed !== undefined

  const handleSelect = (id: string) => {
    if (isConfirmed) return

    if (selectionMode === 'single') {
      // Single select: immediately confirm
      onConfirm?.([id])
    } else {
      // Multi select: toggle selection
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

  // Render confirmed state (receipt view)
  if (isConfirmed) {
    const confirmedOptions = options.filter(opt => confirmed.includes(opt.id))
    return (
      <div className={cn('border bg-muted/30 p-4', className)}>
        <p className="text-sm text-muted-foreground mb-2">{question}</p>
        <div className="flex flex-wrap gap-2">
          {confirmedOptions.map(opt => (
            <div
              key={opt.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              <Check className="h-3.5 w-3.5" />
              {opt.label}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Render interactive state
  return (
    <div className={cn('border bg-card p-4', className)}>
      <p className="text-sm font-medium mb-3">{question}</p>

      <div className="flex flex-wrap gap-2" role="listbox" aria-multiselectable={selectionMode === 'multi'}>
        {options.map(opt => {
          const isSelected = selected.has(opt.id)
          return (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => handleSelect(opt.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected && 'bg-primary text-primary-foreground border-primary hover:bg-primary/90',
                !isSelected && 'bg-background'
              )}
            >
              {selectionMode === 'multi' && isSelected && <Check className="h-3.5 w-3.5" />}
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Description for selected option (single mode) */}
      {selectionMode === 'single' && options.some(o => o.description) && (
        <div className="mt-2 text-xs text-muted-foreground">
          Click an option to select
        </div>
      )}

      {/* Multi-select confirmation buttons */}
      {selectionMode === 'multi' && (
        <div className="flex items-center gap-2 mt-4 pt-3 border-t">
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={selected.size === 0}
          >
            Confirm ({selected.size})
          </Button>
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      )}

      {/* Free text hint */}
      {allowFreeText && (
        <p className="mt-3 text-xs text-muted-foreground">
          Or type your own answer below
        </p>
      )}
    </div>
  )
}
