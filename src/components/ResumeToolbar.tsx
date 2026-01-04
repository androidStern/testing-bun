import { Download, Eye, Printer, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { ExpandableTabs } from '@/components/resume/expandable-tabs'

interface ResumeToolbarProps {
  onImport: () => void
  onPreview: () => void
  onDownload: () => void
  onPrint: () => void
  isImporting?: boolean
  isDownloading?: boolean
  backButton?: ReactNode
}

export function ResumeToolbar({
  onImport,
  onPreview,
  onDownload,
  onPrint,
  isImporting = false,
  isDownloading = false,
  backButton,
}: ResumeToolbarProps) {
  const tabs = [
    { icon: Upload, title: isImporting ? 'Importing...' : 'Import' },
    { icon: Eye, title: 'Preview' },
    { type: 'separator' as const },
    { icon: Download, title: isDownloading ? 'Downloading...' : 'Download' },
    { icon: Printer, title: 'Print' },
  ]

  const handleTabChange = (index: number | null) => {
    if (index === null) return

    // Map tab indices to actions (accounting for separator)
    switch (index) {
      case 0:
        if (!isImporting) onImport()
        break
      case 1:
        onPreview()
        break
      case 3:
        if (!isDownloading) onDownload()
        break
      case 4:
        onPrint()
        break
    }
  }

  return (
    <div className='sticky top-0 z-40 flex justify-end py-3'>
      <div className='flex flex-col items-end gap-1'>
        {backButton}
        <ExpandableTabs
          className='bg-card border-border shadow-lg'
          onChange={handleTabChange}
          tabs={tabs}
        />
      </div>
    </div>
  )
}
