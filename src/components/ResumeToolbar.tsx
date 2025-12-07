import { Download, Eye, Printer, Upload } from 'lucide-react'
import { ExpandableTabs } from '@/components/ui/expandable-tabs'

interface ResumeToolbarProps {
  onImport: () => void
  onPreview: () => void
  onDownload: () => void
  onPrint: () => void
  isImporting?: boolean
  isDownloading?: boolean
}

export function ResumeToolbar({
  onImport,
  onPreview,
  onDownload,
  onPrint,
  isImporting = false,
  isDownloading = false,
}: ResumeToolbarProps) {
  const tabs = [
    { title: isImporting ? 'Importing...' : 'Import', icon: Upload },
    { title: 'Preview', icon: Eye },
    { type: 'separator' as const },
    { title: isDownloading ? 'Downloading...' : 'Download', icon: Download },
    { title: 'Print', icon: Printer },
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
      <ExpandableTabs
        tabs={tabs}
        onChange={handleTabChange}
        className='bg-card border-border shadow-lg'
      />
    </div>
  )
}
