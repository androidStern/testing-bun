'use client'

import { Bug } from 'lucide-react'

import { usePromptOverride } from '../../../hooks/use-prompt-override'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../ui/sheet'

import { PromptEditor } from './PromptEditor'
import { ThreadTree } from './ThreadTree'

interface AdminDebugDrawerProps {
  onOpenChange: (open: boolean) => void
  open: boolean
  threadId: string | null
}

export function AdminDebugDrawer({ onOpenChange, open, threadId }: AdminDebugDrawerProps) {
  const { clearOverride, isDirty, promptOverride, setPromptOverride } = usePromptOverride()

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className='w-80 p-0 flex flex-col' side='left'>
        <SheetHeader className='px-3 py-2 border-b'>
          <SheetTitle className='flex items-center gap-2 text-sm'>
            <Bug className='h-4 w-4' />
            Debug Panel
          </SheetTitle>
        </SheetHeader>

        <div className='flex-1 flex flex-col min-h-0'>
          <div className='flex-1 min-h-0 border-b overflow-hidden'>
            <ThreadTree threadId={threadId} />
          </div>

          <div className='flex-1 min-h-0 overflow-hidden'>
            <PromptEditor
              isDirty={isDirty}
              onChange={setPromptOverride}
              onClear={clearOverride}
              value={promptOverride}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
