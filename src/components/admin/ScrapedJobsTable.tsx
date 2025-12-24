/**
 * Scraped Jobs Table - Admin view for Typesense-indexed jobs
 * Search-as-you-type with URL-persisted filters using TanStack Query + Router
 */

import { useState, useEffect } from 'react';
import { useAction } from 'convex/react';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useDebouncedCallback } from 'use-debounce';
import { api } from '../../../convex/_generated/api';
import { Trash2 } from 'lucide-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { useToast } from '../../hooks/use-toast';

// Typesense config from environment
const TYPESENSE_URL = import.meta.env.VITE_TYPESENSE_URL || 'http://localhost:8108';
const TYPESENSE_SEARCH_KEY = import.meta.env.VITE_TYPESENSE_SEARCH_KEY || '';

// Route API for accessing search params
const routeApi = getRouteApi('/_authenticated/_admin/admin');

// Filter keys that map to boolean Typesense fields
const FILTER_KEYS = [
  'second_chance',
  'no_background_check',
  'bus_accessible',
  'rail_accessible',
  'shift_morning',
  'shift_afternoon',
  'shift_evening',
  'shift_overnight',
  'shift_flexible',
  'is_urgent',
  'is_easy_apply',
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];

interface SearchResult {
  found: number;
  page: number;
  hits: Array<{
    document: {
      id: string;
      title: string;
      company: string;
      city?: string;
      state?: string;
      transit_score?: number;
      second_chance?: boolean;
      shift_morning?: boolean;
      shift_afternoon?: boolean;
      shift_evening?: boolean;
      shift_overnight?: boolean;
      posted_at: number;
      url: string;
    };
  }>;
  facet_counts?: Array<{
    field_name: string;
    counts: Array<{ value: string; count: number }>;
  }>;
}

interface SearchParams {
  q: string;
  page: number;
  filters: Partial<Record<FilterKey, boolean>>;
}

async function searchTypesense(params: SearchParams): Promise<SearchResult> {
  if (!TYPESENSE_SEARCH_KEY) {
    throw new Error('Typesense search key not configured');
  }

  // Build filter string from active filters
  const filterParts: string[] = [];
  for (const [key, value] of Object.entries(params.filters)) {
    if (value === true) {
      filterParts.push(`${key}:=true`);
    }
  }

  const searchParams = new URLSearchParams({
    q: params.q || '*',
    query_by: 'title,company,description',
    page: String(params.page),
    per_page: '25',
    facet_by: 'source,city,state,second_chance,no_background_check,bus_accessible,rail_accessible,shift_morning,shift_afternoon,shift_evening,shift_overnight,shift_flexible,is_urgent,is_easy_apply',
  });

  if (filterParts.length > 0) {
    searchParams.set('filter_by', filterParts.join(' && '));
  }

  const response = await fetch(
    `${TYPESENSE_URL}/collections/jobs/documents/search?${searchParams}`,
    {
      headers: {
        'X-TYPESENSE-API-KEY': TYPESENSE_SEARCH_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export function ScrapedJobsTable() {
  // Read search params from URL
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  // Local state for controlled input (synced with URL)
  const [inputQuery, setInputQuery] = useState(search.q);

  // Selection state (local only - not URL-worthy)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'bulk' | null>(null);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { toast } = useToast();
  const deleteJob = useAction(api.scrapedJobs.adminDeleteJob);

  // Sync input when URL changes externally (back/forward navigation)
  useEffect(() => {
    setInputQuery(search.q);
  }, [search.q]);

  // Debounced URL update (300ms delay)
  const debouncedUpdateUrl = useDebouncedCallback((newQuery: string) => {
    navigate({
      to: '.',
      search: (prev) => ({ ...prev, q: newQuery, page: 1 }),
      replace: true, // Don't spam history
    });
  }, 300);

  // Handle input change: update local state immediately, debounce URL update
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setInputQuery(newQuery);
    debouncedUpdateUrl(newQuery);
  };

  // Derive filters from search params
  const filters: Partial<Record<FilterKey, boolean>> = {};
  for (const key of FILTER_KEYS) {
    if (search[key] === true) {
      filters[key] = true;
    }
  }

  // Use TanStack Query for search - keys off URL params
  const {
    data: results,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['typesense-jobs', search.q, search.page, filters],
    queryFn: () => searchTypesense({ q: search.q, page: search.page, filters }),
    staleTime: 30_000, // Consider data fresh for 30s
  });

  // Toggle filter updates URL immediately (no debounce needed)
  const toggleFilter = (key: FilterKey) => {
    navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        [key]: prev[key] ? undefined : true,
        page: 1, // Reset to page 1 when filter changes
      }),
    });
  };

  // Pagination updates URL
  const goToPage = (newPage: number) => {
    navigate({
      to: '.',
      search: (prev) => ({ ...prev, page: newPage }),
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatShifts = (doc: SearchResult['hits'][0]['document']) => {
    const shifts = [];
    if (doc.shift_morning) shifts.push('AM');
    if (doc.shift_afternoon) shifts.push('PM');
    if (doc.shift_evening) shifts.push('Eve');
    if (doc.shift_overnight) shifts.push('Night');
    return shifts.length > 0 ? shifts.join(', ') : '-';
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (!results) return;
    const allIds = results.hits.map((hit) => hit.document.id);
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Delete handlers
  const handleDeleteSingle = (typesenseId: string) => {
    setSingleDeleteId(typesenseId);
    setDeleteTarget('single');
    setDeleteDialogOpen(true);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget('bulk');
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      if (deleteTarget === 'single' && singleDeleteId) {
        await deleteJob({ typesenseId: singleDeleteId });
        toast({
          title: 'Job deleted',
          description: 'The job has been removed from all systems.',
        });
      } else if (deleteTarget === 'bulk') {
        const typesenseIds = Array.from(selectedIds);
        let deleted = 0;
        let failed = 0;
        for (const typesenseId of typesenseIds) {
          try {
            await deleteJob({ typesenseId });
            deleted++;
          } catch (err) {
            console.error(`[Admin] Failed to delete job ${typesenseId}:`, err);
            failed++;
          }
        }
        toast({
          title: 'Jobs deleted',
          description: `Deleted ${deleted} jobs${failed > 0 ? `, ${failed} failed` : ''}.`,
        });
        setSelectedIds(new Set());
      }
      // Refetch search results
      await refetch();
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Failed to delete job(s)',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setSingleDeleteId(null);
    }
  };

  // Check if search is pending (either loading or debounce pending)
  const isPending = isLoading || debouncedUpdateUrl.isPending();

  return (
    <div className="space-y-4">
      {/* Search Bar - search-as-you-type */}
      <div className="flex gap-2">
        <Input
          placeholder="Search jobs..."
          value={inputQuery}
          onChange={handleQueryChange}
          className="flex-1"
        />
        {isPending && (
          <span className="text-sm text-gray-400 self-center">Searching...</span>
        )}
        {selectedIds.size > 0 && (
          <Button
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Facet Filters */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-gray-500 mr-2">Filters:</span>

        <FilterCheckbox
          label="Second Chance"
          checked={filters.second_chance === true}
          onChange={() => toggleFilter('second_chance')}
        />
        <FilterCheckbox
          label="No BG Check"
          checked={filters.no_background_check === true}
          onChange={() => toggleFilter('no_background_check')}
        />
        <FilterCheckbox
          label="Bus"
          checked={filters.bus_accessible === true}
          onChange={() => toggleFilter('bus_accessible')}
        />
        <FilterCheckbox
          label="Rail"
          checked={filters.rail_accessible === true}
          onChange={() => toggleFilter('rail_accessible')}
        />

        <span className="text-gray-300 mx-1">|</span>

        <FilterCheckbox
          label="Morning"
          checked={filters.shift_morning === true}
          onChange={() => toggleFilter('shift_morning')}
        />
        <FilterCheckbox
          label="Afternoon"
          checked={filters.shift_afternoon === true}
          onChange={() => toggleFilter('shift_afternoon')}
        />
        <FilterCheckbox
          label="Evening"
          checked={filters.shift_evening === true}
          onChange={() => toggleFilter('shift_evening')}
        />
        <FilterCheckbox
          label="Overnight"
          checked={filters.shift_overnight === true}
          onChange={() => toggleFilter('shift_overnight')}
        />

        <span className="text-gray-300 mx-1">|</span>

        <FilterCheckbox
          label="Urgent"
          checked={filters.is_urgent === true}
          onChange={() => toggleFilter('is_urgent')}
        />
        <FilterCheckbox
          label="Easy Apply"
          checked={filters.is_easy_apply === true}
          onChange={() => toggleFilter('is_easy_apply')}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          {error instanceof Error ? error.message : 'Search failed'}
        </div>
      )}

      {/* Results */}
      {results && (
        <>
          <div className="text-sm text-gray-500">
            Found {results.found} jobs
          </div>

          {/* Table */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={results.hits.length > 0 && selectedIds.size === results.hits.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-2 text-left font-medium">Title</th>
                  <th className="px-4 py-2 text-left font-medium">Company</th>
                  <th className="px-4 py-2 text-left font-medium">Location</th>
                  <th className="px-4 py-2 text-left font-medium">Transit</th>
                  <th className="px-4 py-2 text-left font-medium">Shifts</th>
                  <th className="px-4 py-2 text-left font-medium">2nd Ch</th>
                  <th className="px-4 py-2 text-left font-medium">Posted</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.hits.map((hit) => (
                  <tr key={hit.document.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(hit.document.id)}
                        onChange={() => toggleSelect(hit.document.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <a
                        href={hit.document.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {hit.document.title}
                      </a>
                    </td>
                    <td className="px-4 py-2">{hit.document.company}</td>
                    <td className="px-4 py-2">
                      {hit.document.city}
                      {hit.document.state && `, ${hit.document.state}`}
                    </td>
                    <td className="px-4 py-2">
                      {hit.document.transit_score != null
                        ? scoreToGrade(hit.document.transit_score)
                        : '-'}
                    </td>
                    <td className="px-4 py-2">{formatShifts(hit.document)}</td>
                    <td className="px-4 py-2">
                      {hit.document.second_chance ? (
                        <span className="text-green-600">Yes</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {formatDate(hit.document.posted_at)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => handleDeleteSingle(hit.document.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete job"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {results.found > 25 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">
                Page {search.page} of {Math.ceil(results.found / 25)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(search.page - 1)}
                  disabled={search.page <= 1 || isLoading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(search.page + 1)}
                  disabled={search.page >= Math.ceil(results.found / 25) || isLoading}
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
        <div className="text-center text-gray-500 py-8">Loading jobs...</div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job{deleteTarget === 'bulk' ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget === 'single'
                ? 'This will permanently delete this job from Convex, Typesense, and the Redis dedup cache.'
                : `This will permanently delete ${selectedIds.size} job${selectedIds.size > 1 ? 's' : ''} from Convex, Typesense, and the Redis dedup cache.`}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-1 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded border-gray-300"
      />
      <span className={checked ? 'font-medium' : ''}>{label}</span>
    </label>
  );
}

function scoreToGrade(score: number): string {
  if (score >= 100) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}
