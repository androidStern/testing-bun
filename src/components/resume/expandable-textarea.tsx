import { Maximize2 } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

interface ExpandableTextareaProps {
  className?: string
  modalTitle?: string
  onBlur?: () => void
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  value: string
}

export function ExpandableTextarea({
  className,
  modalTitle = 'Edit',
  onBlur,
  onChange,
  placeholder,
  rows = 4,
  value,
}: ExpandableTextareaProps) {
  const [isOpen, setIsOpen] = useState(false)

  const textareaClasses =
    'bg-input text-foreground w-full px-3 py-2.5 border border-border focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none'

  return (
    <>
      <div className='relative'>
        <textarea
          className={cn(textareaClasses, 'pr-10', className)}
          onBlur={onBlur}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          value={value}
        />
        <button
          aria-label='Expand editor'
          className='absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors'
          onClick={() => setIsOpen(true)}
          type='button'
        >
          <Maximize2 className='h-4 w-4' />
        </button>
      </div>

      <Dialog
        open={isOpen}
        onOpenChange={open => {
          setIsOpen(open)
          if (!open) onBlur?.()
        }}
      >
        <DialogContent className='h-[85vh] max-w-[95vw] sm:max-w-2xl flex flex-col'>
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
          </DialogHeader>
          <textarea
            autoFocus
            className={cn(textareaClasses, 'flex-1 min-h-0')}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            value={value}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
