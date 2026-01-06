import {
  ActionBarPrimitive,
  AssistantIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessage,
} from '@assistant-ui/react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  PencilIcon,
  RefreshCwIcon,
  SquareIcon,
} from 'lucide-react'
import type { FC } from 'react'
import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from '@/components/assistant-ui/attachment'
import { MarkdownText } from '@/components/assistant-ui/markdown-text'
import { ToolFallback } from '@/components/assistant-ui/tool-fallback'
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root
      className='aui-root aui-thread-root @container flex h-full flex-col bg-background'
      style={{
        ['--thread-max-width' as string]: '44rem',
      }}
    >
      <ThreadPrimitive.Viewport className='aui-thread-viewport relative flex flex-1 flex-col overflow-y-auto overscroll-contain min-h-0 scroll-smooth px-4 pt-4'>
        <AssistantIf condition={({ thread }) => thread.isEmpty}>
          <ThreadWelcome />
        </AssistantIf>

        <ThreadPrimitive.Messages
          components={{
            AssistantMessage,
            EditComposer,
            UserMessage,
          }}
        />

        <div className='shrink-0 h-4' />
      </ThreadPrimitive.Viewport>

      <div className='aui-thread-footer shrink-0 relative mx-auto w-full max-w-(--thread-max-width) flex flex-col items-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-background'>
        <ThreadScrollToBottom />
        <Composer />
      </div>
    </ThreadPrimitive.Root>
  )
}

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        className='aui-thread-scroll-to-bottom absolute -top-10 z-10 rounded-full p-3 disabled:invisible bg-background hover:bg-accent border shadow-sm'
        tooltip='Scroll to bottom'
        variant='outline'
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  )
}

const ThreadWelcome: FC = () => {
  return (
    <div className='aui-thread-welcome-root mx-auto my-auto flex w-full max-w-(--thread-max-width) grow flex-col'>
      <div className='aui-thread-welcome-center flex w-full grow flex-col items-center justify-center'>
        <div className='aui-thread-welcome-message flex size-full flex-col justify-center px-4'>
          <h1 className='aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in font-semibold text-2xl duration-200'>
            Let's find your next job
          </h1>
          <p className='aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in text-muted-foreground text-xl delay-75 duration-200'>
            What kind of work are you looking for?
          </p>
        </div>
      </div>
      <ThreadSuggestions />
    </div>
  )
}

const SUGGESTIONS = [
  {
    label: 'near me with flexible hours',
    prompt: 'Find warehouse jobs near me with flexible hours',
    title: 'Find warehouse jobs',
  },
  {
    label: 'friendly employers',
    prompt: 'Show me employers that are second chance friendly',
    title: 'Show me second chance',
  },
] as const

const ThreadSuggestions: FC = () => {
  return (
    <div className='aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2 pb-4'>
      {SUGGESTIONS.map((suggestion, index) => (
        <div
          className='aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 @md:nth-[n+3]:block nth-[n+3]:hidden animate-in fill-mode-both duration-200'
          key={suggestion.prompt}
          style={{ animationDelay: `${100 + index * 50}ms` }}
        >
          <ThreadPrimitive.Suggestion asChild prompt={suggestion.prompt} send>
            <Button
              aria-label={suggestion.prompt}
              className='aui-thread-welcome-suggestion h-auto w-full @md:flex-col flex-wrap items-start justify-start gap-1 rounded-2xl border px-4 py-3 text-left text-sm transition-colors hover:bg-muted'
              variant='ghost'
            >
              <span className='aui-thread-welcome-suggestion-text-1 font-medium'>
                {suggestion.title}
              </span>
              <span className='aui-thread-welcome-suggestion-text-2 text-muted-foreground'>
                {suggestion.label}
              </span>
            </Button>
          </ThreadPrimitive.Suggestion>
        </div>
      ))}
    </div>
  )
}

const Composer: FC = () => {
  return (
    <ComposerPrimitive.Root className='aui-composer-root relative flex w-full flex-col'>
      <ComposerPrimitive.AttachmentDropzone className='aui-composer-attachment-dropzone flex w-full flex-col rounded-2xl border border-input bg-background px-1 pt-2 outline-none transition-shadow has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-ring/20 data-[dragging=true]:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/50'>
        <ComposerAttachments />
        <ComposerPrimitive.Input
          aria-label='Message input'
          autoFocus
          className='aui-composer-input mb-1 max-h-32 min-h-14 w-full resize-none bg-transparent px-4 pt-2 pb-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0'
          placeholder='Ask about jobs or refine your search...'
          rows={1}
        />
        <ComposerAction />
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  )
}

const ComposerAction: FC = () => {
  return (
    <div className='aui-composer-action-wrapper relative mx-2 mb-2 flex items-center justify-between'>
      <ComposerAddAttachment />

      <AssistantIf condition={({ thread }) => !thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            aria-label='Send message'
            className='aui-composer-send size-8 rounded-full'
            side='bottom'
            size='icon'
            tooltip='Send message'
            type='submit'
            variant='default'
          >
            <ArrowUpIcon className='aui-composer-send-icon size-4' />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </AssistantIf>

      <AssistantIf condition={({ thread }) => thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <Button
            aria-label='Stop generating'
            className='aui-composer-cancel size-8 rounded-full'
            size='icon'
            type='button'
            variant='default'
          >
            <SquareIcon className='aui-composer-cancel-icon size-3 fill-current' />
          </Button>
        </ComposerPrimitive.Cancel>
      </AssistantIf>
    </div>
  )
}

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className='aui-message-error-root mt-2 border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200'>
        <ErrorPrimitive.Message className='aui-message-error-message line-clamp-2' />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  )
}

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className='aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-3 duration-150'
      data-role='assistant'
    >
      <div className='aui-assistant-message-content wrap-break-word px-2 text-foreground leading-relaxed'>
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            tools: { Fallback: ToolFallback },
          }}
        />
        <MessageError />
      </div>

      {/* <div className='aui-assistant-message-footer mt-1 ml-2 flex'>
        <BranchPicker />
        <AssistantActionBar />
      </div> */}
    </MessagePrimitive.Root>
  )
}

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      autohide='not-last'
      autohideFloat='single-branch'
      className='aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground data-floating:absolute data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm'
      hideWhenRunning
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip='Copy'>
          <AssistantIf condition={({ message }) => message.isCopied}>
            <CheckIcon />
          </AssistantIf>
          <AssistantIf condition={({ message }) => !message.isCopied}>
            <CopyIcon />
          </AssistantIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.ExportMarkdown asChild>
        <TooltipIconButton tooltip='Export as Markdown'>
          <DownloadIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.ExportMarkdown>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip='Refresh'>
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  )
}

function parseSelection(jsonStr: string): Array<{ key: string; value: string }> {
  try {
    const data = JSON.parse(jsonStr)
    return Object.entries(data)
      .filter(([, v]) => v !== false && v !== null && v !== undefined)
      .map(([k, v]) => ({
        key: k
          .replace(/([A-Z])/g, ' $1')
          .toLowerCase()
          .trim(),
        value: String(v),
      }))
  } catch {
    return [{ key: 'selection', value: jsonStr }]
  }
}

const UserMessage: FC = () => {
  const textContent = useMessage(state => {
    const textPart = state.content.find(p => p.type === 'text')
    return textPart && 'text' in textPart ? textPart.text : ''
  })

  const isSyntheticSelection = textContent.startsWith('[selected] ')

  if (isSyntheticSelection) {
    const rawJson = textContent.replace('[selected] ', '')
    const entries = parseSelection(rawJson)
    return (
      <MessagePrimitive.Root
        className='mx-auto w-full max-w-(--thread-max-width) px-2 py-2'
        data-role='user'
      >
        <div className='flex justify-end flex-wrap gap-1.5'>
          {entries.map(({ key, value }) => (
            <span
              className='inline-flex items-center gap-1 bg-muted rounded-full px-3 py-1 text-xs'
              key={key}
            >
              <span className='text-muted-foreground'>{key}:</span>
              <span className='font-medium'>{value}</span>
            </span>
          ))}
        </div>
      </MessagePrimitive.Root>
    )
  }

  // Normal user message rendering
  return (
    <MessagePrimitive.Root
      className='aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto grid w-full max-w-(--thread-max-width) animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-3 duration-150 [&:where(>*)]:col-start-2'
      data-role='user'
    >
      <UserMessageAttachments />

      <div className='aui-user-message-content-wrapper relative col-start-2 min-w-0'>
        <div className='aui-user-message-content wrap-break-word rounded-2xl bg-muted px-4 py-2.5 text-foreground'>
          <MessagePrimitive.Parts />
        </div>
        <div className='aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2'>
          <UserActionBar />
        </div>
      </div>

      {/* <BranchPicker className='aui-user-branch-picker col-span-full col-start-1 row-start-3 -mr-1 justify-end' /> */}
    </MessagePrimitive.Root>
  )
}

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      autohide='not-last'
      className='aui-user-action-bar-root flex flex-col items-end'
      hideWhenRunning
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton className='aui-user-action-edit p-4' tooltip='Edit'>
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  )
}

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root className='aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-max-width) flex-col px-2 py-3'>
      <ComposerPrimitive.Root className='aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-muted'>
        <ComposerPrimitive.Input
          autoFocus
          className='aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm outline-none'
        />
        <div className='aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end'>
          <ComposerPrimitive.Cancel asChild>
            <Button size='sm' variant='ghost'>
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size='sm'>Update</Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  )
}

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({ className, ...rest }) => {
  return (
    <BranchPickerPrimitive.Root
      className={cn(
        'aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-muted-foreground text-xs',
        className,
      )}
      hideWhenSingleBranch
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip='Previous'>
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className='aui-branch-picker-state font-medium'>
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip='Next'>
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  )
}
