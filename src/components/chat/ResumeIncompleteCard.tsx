'use client'

import { Link } from '@tanstack/react-router'
import { FileEdit, Search } from 'lucide-react'

import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

interface ResumeIncompleteCardProps {
  onComplete: () => void
  pendingSearch?: string
}

export function ResumeIncompleteCard({ onComplete, pendingSearch }: ResumeIncompleteCardProps) {
  return (
    <Card className='w-full max-w-2xl'>
      <CardHeader className='text-center'>
        <CardTitle className='flex items-center justify-center gap-2'>
          <FileEdit className='h-5 w-5' />
          Your resume needs more detail
        </CardTitle>
        <CardDescription>
          Add work experience or skills to help us find better matches for you
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {pendingSearch && (
          <div className='rounded-lg border bg-muted/30 p-3'>
            <div className='flex items-start gap-2 text-sm'>
              <Search className='mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground' />
              <div>
                <p className='text-muted-foreground'>Your search:</p>
                <p className='font-medium'>"{pendingSearch}"</p>
              </div>
            </div>
          </div>
        )}

        <div className='flex flex-col gap-3 pt-2'>
          <Button asChild size='lg'>
            <Link search={{ returnPrompt: pendingSearch }} to='/resumes'>
              Complete My Resume
            </Link>
          </Button>

          <div className='text-center'>
            <Button
              className='text-muted-foreground hover:text-foreground'
              onClick={onComplete}
              size='sm'
              variant='ghost'
            >
              Skip for now →
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
