/**
 * Scraped Jobs Table - Admin view for Typesense-indexed jobs
 * Search-as-you-type with URL-persisted filters using TanStack Query + Router
 */

import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { api } from '../../../convex/_generated/api'
import { useToast } from '../../hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { SecondChanceAuditDetails } from './SecondChanceAuditDetails'

// Typesense config from environment
const TYPESENSE_URL = import.meta.env.VITE_TYPESENSE_URL || 'http://localhost:8108'
const TYPESENSE_SEARCH_KEY = import.meta.env.VITE_TYPESENSE_SEARCH_KEY || ''

// Route API for accessing search params
const routeApi = getRouteApi('/_authenticated/_admin/admin')

// Filter keys that map to boolean Typesense fields
const FILTER_KEYS = [
  // Second-chance tier filters (new multi-signal scoring)
  'tier_high',
  'tier_medium',
  'tier_low',
  'tier_unlikely',
  'tier_unknown',
  // Source filters
  'source_snagajob',
  'source_craigslist',
  // Job type filters
  'job_type_job',
  'job_type_gig',
  // Transit
  'bus_accessible',
  'rail_accessible',
  // Shifts
  'shift_morning',
  'shift_afternoon',
  'shift_evening',
  'shift_overnight',
  'shift_flexible',
  // Job metadata
  'is_urgent',
  'is_easy_apply',
] as const

type FilterKey = (typeof FILTER_KEYS)[number]

interface SearchResult {
  found: number
  page: number
  hits: Array<{
    document: {
      id: string
      title: string
      company: string
      source?: string
      job_type?: string
      city?: string
      state?: string
      transit_score?: number
      second_chance_tier?: 'high' | 'medium' | 'low' | 'unlikely' | 'unknown'
      second_chance_score?: number
      second_chance_confidence?: number
      shift_morning?: boolean
      shift_afternoon?: boolean
      shift_evening?: boolean
      shift_overnight?: boolean
      posted_at: number
      url: string
    }
  }>
  facet_counts?: Array<{
    field_name: string
    counts: Array<{ value: string; count: number }>
  }>
}

interface SearchParams {
  q: string
  page: number
  filters: Partial<Record<FilterKey, boolean>>
}

async function searchTypesense(params: SearchParams): Promise<SearchResult> {
  if (!TYPESENSE_SEARCH_KEY) {
    throw new Error('Typesense search key not configured')
  }

  // Build filter string from active filters
  const filterParts: string[] = []

  // Handle tier filters specially - combine into OR filter for second_chance_tier
  const selectedTiers: string[] = []
  if (params.filters.tier_high) selectedTiers.push('high')
  if (params.filters.tier_medium) selectedTiers.push('medium')
  if (params.filters.tier_low) selectedTiers.push('low')
  if (params.filters.tier_unlikely) selectedTiers.push('unlikely')
  if (params.filters.tier_unknown) selectedTiers.push('unknown')

  if (selectedTiers.length > 0) {
    filterParts.push(`second_chance_tier:[${selectedTiers.join(',')}]`)
  }

  // Handle source filters - combine into OR filter for source
  const selectedSources: string[] = []
  if (params.filters.source_snagajob) selectedSources.push('snagajob')
  if (params.filters.source_craigslist) selectedSources.push('craigslist')

  if (selectedSources.length > 0) {
    filterParts.push(`source:[${selectedSources.join(',')}]`)
  }

  // Handle job type filters - combine into OR filter for job_type
  const selectedJobTypes: string[] = []
  if (params.filters.job_type_job) selectedJobTypes.push('job')
  if (params.filters.job_type_gig) selectedJobTypes.push('gig')

  if (selectedJobTypes.length > 0) {
    filterParts.push(`job_type:[${selectedJobTypes.join(',')}]`)
  }

  // Handle other boolean filters normally (skip tier_, source_, job_type_ which are handled above)
  for (const [key, value] of Object.entries(params.filters)) {
    if (value === true && !key.startsWith('tier_') && !key.startsWith('source_') && !key.startsWith('job_type_')) {
      filterParts.push(`${key}:=true`)
    }
  }

  const searchParams = new URLSearchParams({
    facet_by:
      'source,job_type,city,state,second_chance_tier,bus_accessible,rail_accessible,shift_morning,shift_afternoon,shift_evening,shift_overnight,shift_flexible,is_urgent,is_easy_apply',
    page: String(params.page),
    per_page: '25',
    q: params.q || '*',
    query_by: 'title,company,description',
  })

  if (filterParts.length > 0) {
    searchParams.set('filter_by', filterParts.join(' && '))
  }

  const response = await fetch(
    `${TYPESENSE_URL}/collections/jobs/documents/search?${searchParams}`,
    {
      headers: {
        'X-TYPESENSE-API-KEY': TYPESENSE_SEARCH_KEY,
      },
    },
  )

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export function ScrapedJobsTable() {
  // Read search params from URL
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()

  // Local state for controlled input (synced with URL)
  const [inputQuery, setInputQuery] = useState(search.q)

  // Selection state (local only - not URL-worthy)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'bulk' | null>(null)
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null)

  // Audit dialog state
  const [auditJobId, setAuditJobId] = useState<string | null>(null)
  const [auditJobTitle, setAuditJobTitle] = useState<string>('')
  const [auditJobCompany, setAuditJobCompany] = useState<string>('')
  const [deleting, setDeleting] = useState(false)

  const { toast } = useToast()
  const deleteJob = useAction(api.scrapedJobs.adminDeleteJob)

  // Sync input when URL changes externally (back/forward navigation)
  useEffect(() => {
    setInputQuery(search.q)
  }, [search.q])

  // Debounced URL update (300ms delay)
  const debouncedUpdateUrl = useDebouncedCallback((newQuery: string) => {
    navigate({
      replace: true, // Don't spam history
      search: prev => ({ ...prev, page: 1, q: newQuery }),
      to: '.',
    })
  }, 300)

  // Handle input change: update local state immediately, debounce URL update
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setInputQuery(newQuery)
    debouncedUpdateUrl(newQuery)
  }

  // Derive filters from search params
  const filters: Partial<Record<FilterKey, boolean>> = {}
  for (const key of FILTER_KEYS) {
    if (search[key] === true) {
      filters[key] = true
    }
  }

  // Use TanStack Query for search - keys off URL params
  const {
    data: results,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryFn: () => searchTypesense({ filters, page: search.page, q: search.q }),
    queryKey: ['typesense-jobs', search.q, search.page, filters],
    staleTime: 30_000, // Consider data fresh for 30s
  })

  // Toggle filter updates URL immediately (no debounce needed)
  const toggleFilter = (key: FilterKey) => {
    navigate({
      search: prev => ({
        ...prev,
        [key]: prev[key] ? undefined : true,
        page: 1, // Reset to page 1 when filter changes
      }),
      to: '.',
    })
  }

  // Pagination updates URL
  const goToPage = (newPage: number) => {
    navigate({
      search: prev => ({ ...prev, page: newPage }),
      to: '.',
    })
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const formatShifts = (doc: SearchResult['hits'][0]['document']) => {
    const shifts = []
    if (doc.shift_morning) shifts.push('AM')
    if (doc.shift_afternoon) shifts.push('PM')
    if (doc.shift_evening) shifts.push('Eve')
    if (doc.shift_overnight) shifts.push('Night')
    return shifts.length > 0 ? shifts.join(', ') : '-'
  }

  // Selection handlers
  const toggleSelectAll = () => {
    if (!results) return
    const allIds = results.hits.map(hit => hit.document.id)
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Delete handlers
  const handleDeleteSingle = (typesenseId: string) => {
    setSingleDeleteId(typesenseId)
    setDeleteTarget('single')
    setDeleteDialogOpen(true)
  }

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return
    setDeleteTarget('bulk')
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      if (deleteTarget === 'single' && singleDeleteId) {
        await deleteJob({ typesenseId: singleDeleteId })
        toast({
          description: 'The job has been removed from all systems.',
          title: 'Job deleted',
        })
      } else if (deleteTarget === 'bulk') {
        const typesenseIds = Array.from(selectedIds)
        let deleted = 0
        let failed = 0
        for (const typesenseId of typesenseIds) {
          try {
            await deleteJob({ typesenseId })
            deleted++
          } catch (err) {
            console.error(`[Admin] Failed to delete job ${typesenseId}:`, err)
            failed++
          }
        }
        toast({
          description: `Deleted ${deleted} jobs${failed > 0 ? `, ${failed} failed` : ''}.`,
          title: 'Jobs deleted',
        })
        setSelectedIds(new Set())
      }
      // Refetch search results
      await refetch()
    } catch (err) {
      toast({
        description: err instanceof Error ? err.message : 'Failed to delete job(s)',
        title: 'Delete failed',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      setSingleDeleteId(null)
    }
  }

  // Check if search is pending (either loading or debounce pending)
  const isPending = isLoading || debouncedUpdateUrl.isPending()

  return (
    <div className='space-y-4'>
      {/* Search Bar - search-as-you-type */}
      <div className='flex gap-2'>
        <Input
          className='flex-1'
          onChange={handleQueryChange}
          placeholder='Search jobs...'
          value={inputQuery}
        />
        {isPending && <span className='text-sm text-gray-400 self-center'>Searching...</span>}
        {selectedIds.size > 0 && (
          <Button disabled={deleting} onClick={handleDeleteSelected} variant='destructive'>
            <Trash2 className='h-4 w-4 mr-2' />
            Delete ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Facet Filters */}
      <div className='flex flex-wrap gap-2 text-sm'>
        <span className='text-gray-500 mr-2'>Second Chance:</span>
        <FilterCheckbox
          checked={filters.tier_high === true}
          label='High'
          onChange={() => toggleFilter('tier_high')}
        />
        <FilterCheckbox
          checked={filters.tier_medium === true}
          label='Medium'
          onChange={() => toggleFilter('tier_medium')}
        />
        <FilterCheckbox
          checked={filters.tier_low === true}
          label='Low'
          onChange={() => toggleFilter('tier_low')}
        />
        <FilterCheckbox
          checked={filters.tier_unlikely === true}
          label='Unlikely'
          onChange={() => toggleFilter('tier_unlikely')}
        />
        <FilterCheckbox
          checked={filters.tier_unknown === true}
          label='Unknown'
          onChange={() => toggleFilter('tier_unknown')}
        />

        <span className='text-gray-300 mx-1'>|</span>

        <span className='text-gray-500 mr-2'>Source:</span>
        <FilterCheckbox
          checked={filters.source_snagajob === true}
          label='Snagajob'
          onChange={() => toggleFilter('source_snagajob')}
        />
        <FilterCheckbox
          checked={filters.source_craigslist === true}
          label='Craigslist'
          onChange={() => toggleFilter('source_craigslist')}
        />

        <span className='text-gray-300 mx-1'>|</span>

        <span className='text-gray-500 mr-2'>Type:</span>
        <FilterCheckbox
          checked={filters.job_type_job === true}
          label='Job'
          onChange={() => toggleFilter('job_type_job')}
        />
        <FilterCheckbox
          checked={filters.job_type_gig === true}
          label='Gig'
          onChange={() => toggleFilter('job_type_gig')}
        />

        <span className='text-gray-300 mx-1'>|</span>

        <span className='text-gray-500 mr-2'>Transit:</span>
        <FilterCheckbox
          checked={filters.bus_accessible === true}
          label='Bus'
          onChange={() => toggleFilter('bus_accessible')}
        />
        <FilterCheckbox
          checked={filters.rail_accessible === true}
          label='Rail'
          onChange={() => toggleFilter('rail_accessible')}
        />

        <span className='text-gray-300 mx-1'>|</span>

        <span className='text-gray-500 mr-2'>Shifts:</span>
        <FilterCheckbox
          checked={filters.shift_morning === true}
          label='Morning'
          onChange={() => toggleFilter('shift_morning')}
        />
        <FilterCheckbox
          checked={filters.shift_afternoon === true}
          label='Afternoon'
          onChange={() => toggleFilter('shift_afternoon')}
        />
        <FilterCheckbox
          checked={filters.shift_evening === true}
          label='Evening'
          onChange={() => toggleFilter('shift_evening')}
        />
        <FilterCheckbox
          checked={filters.shift_overnight === true}
          label='Overnight'
          onChange={() => toggleFilter('shift_overnight')}
        />

        <span className='text-gray-300 mx-1'>|</span>

        <FilterCheckbox
          checked={filters.is_urgent === true}
          label='Urgent'
          onChange={() => toggleFilter('is_urgent')}
        />
        <FilterCheckbox
          checked={filters.is_easy_apply === true}
          label='Easy Apply'
          onChange={() => toggleFilter('is_easy_apply')}
        />
      </div>

      {/* Error */}
      {error && (
        <div className='p-4 bg-red-50 text-red-700 rounded-lg'>
          {error instanceof Error ? error.message : 'Search failed'}
        </div>
      )}

      {/* Results */}
      {results && (
        <>
          <div className='text-sm text-gray-500'>Found {results.found} jobs</div>

          {/* Table */}
          <div className='overflow-x-auto border rounded-lg'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50'>
                <tr>
                  <th className='px-2 py-2 w-10'>
                    <input
                      checked={results.hits.length > 0 && selectedIds.size === results.hits.length}
                      className='rounded border-gray-300'
                      onChange={toggleSelectAll}
                      type='checkbox'
                    />
                  </th>
                  <th className='px-4 py-2 text-left font-medium'>Title</th>
                  <th className='px-4 py-2 text-left font-medium'>Company</th>
                  <th className='px-4 py-2 text-left font-medium'>Source</th>
                  <th className='px-4 py-2 text-left font-medium'>Location</th>
                  <th className='px-4 py-2 text-left font-medium'>Transit</th>
                  <th className='px-4 py-2 text-left font-medium'>Shifts</th>
                  <th className='px-4 py-2 text-left font-medium'>2nd Ch</th>
                  <th className='px-4 py-2 text-left font-medium'>Posted</th>
                  <th className='px-2 py-2 w-10'></th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                {results.hits.map(hit => (
                  <tr className='hover:bg-gray-50' key={hit.document.id}>
                    <td className='px-2 py-2'>
                      <input
                        checked={selectedIds.has(hit.document.id)}
                        className='rounded border-gray-300'
                        onChange={() => toggleSelect(hit.document.id)}
                        type='checkbox'
                      />
                    </td>
                    <td className='px-4 py-2'>
                      <a
                        className='text-blue-600 hover:underline'
                        href={hit.document.url}
                        rel='noopener noreferrer'
                        target='_blank'
                      >
                        {hit.document.title}
                      </a>
                    </td>
                    <td className='px-4 py-2'>{hit.document.company}</td>
                    <td className='px-4 py-2'>
                      <span className='inline-flex items-center gap-1'>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            hit.document.source === 'craigslist'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {hit.document.source || 'snagajob'}
                        </span>
                        {hit.document.job_type === 'gig' && (
                          <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800'>
                            gig
                          </span>
                        )}
                      </span>
                    </td>
                    <td className='px-4 py-2'>
                      {hit.document.city}
                      {hit.document.state && `, ${hit.document.state}`}
                    </td>
                    <td className='px-4 py-2'>
                      {hit.document.transit_score != null
                        ? scoreToGrade(hit.document.transit_score)
                        : '-'}
                    </td>
                    <td className='px-4 py-2'>{formatShifts(hit.document)}</td>
                    <td className='px-4 py-2'>
                      {hit.document.second_chance_tier ? (
                        <button
                          className={`hover:underline cursor-pointer ${
                            hit.document.second_chance_tier === 'high'
                              ? 'text-green-600 font-medium'
                              : hit.document.second_chance_tier === 'medium'
                                ? 'text-green-500'
                                : hit.document.second_chance_tier === 'low'
                                  ? 'text-yellow-600'
                                  : hit.document.second_chance_tier === 'unlikely'
                                    ? 'text-red-500'
                                    : 'text-gray-400'
                          }`}
                          onClick={() => {
                            setAuditJobId(hit.document.id)
                            setAuditJobTitle(hit.document.title)
                            setAuditJobCompany(hit.document.company)
                          }}
                          title='View scoring details'
                        >
                          {hit.document.second_chance_tier}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className='px-4 py-2 text-gray-500'>
                      {formatDate(hit.document.posted_at)}
                    </td>
                    <td className='px-2 py-2'>
                      <button
                        className='p-1 text-gray-400 hover:text-red-600 transition-colors'
                        onClick={() => handleDeleteSingle(hit.document.id)}
                        title='Delete job'
                      >
                        <Trash2 className='h-4 w-4' />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {results.found > 25 && (
            <div className='flex justify-between items-center'>
              <span className='text-sm text-gray-500'>
                Page {search.page} of {Math.ceil(results.found / 25)}
              </span>
              <div className='flex gap-2'>
                <Button
                  disabled={search.page <= 1 || isLoading}
                  onClick={() => goToPage(search.page - 1)}
                  size='sm'
                  variant='outline'
                >
                  Previous
                </Button>
                <Button
                  disabled={search.page >= Math.ceil(results.found / 25) || isLoading}
                  onClick={() => goToPage(search.page + 1)}
                  size='sm'
                  variant='outline'
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading State */}
      {isLoading && !results && (
        <div className='text-center text-gray-500 py-8'>Loading jobs...</div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job{deleteTarget === 'bulk' ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget === 'single'
                ? 'This will permanently delete this job from Convex, Typesense, and the Redis dedup cache.'
                : `This will permanently delete ${selectedIds.size} job${selectedIds.size > 1 ? 's' : ''} from Convex, Typesense, and the Redis dedup cache.`}{' '}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className='bg-red-600 hover:bg-red-700'
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Second Chance Audit Dialog */}
      <Dialog onOpenChange={open => !open && setAuditJobId(null)} open={!!auditJobId}>
        <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Second Chance Score Details</DialogTitle>
            <DialogDescription>
              {auditJobTitle} at {auditJobCompany}
            </DialogDescription>
          </DialogHeader>
          {auditJobId && <SecondChanceAuditDetails typesenseId={auditJobId} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className='flex items-center gap-1 cursor-pointer'>
      <input
        checked={checked}
        className='rounded border-gray-300'
        onChange={onChange}
        type='checkbox'
      />
      <span className={checked ? 'font-medium' : ''}>{label}</span>
    </label>
  )
}

function scoreToGrade(score: number): string {
  if (score >= 100) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 50) return 'C'
  return 'D'
}
