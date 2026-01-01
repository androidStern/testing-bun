import { useAction } from 'convex/react';
import { useState } from 'react';
import { api } from '../../../convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CacheStats {
  indexedJobs: number;
  cachedLocations: number;
  bandBuckets: number;
  today: {
    processed: number;
    duplicates: number;
    indexed: number;
  };
  session: {
    processed: number;
    duplicates: number;
    indexed: number;
    locationVetoes: number;
    geoCacheHits: number;
    geoCacheMisses: number;
    errors: number;
  };
}

interface FairChanceStats {
  totalEmployers: number;
  oldestLastSeen: string | null;
  newestLastSeen: string | null;
  employersSeenToday: number;
  employersStale30Days: number;
  employersStale60Days: number;
}

export function CacheManagement() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [fairChanceStats, setFairChanceStats] = useState<FairChanceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clearResult, setClearResult] = useState<string | null>(null);

  const getCacheStats = useAction(api.scrapedJobs.getCacheStats);
  const getFairChanceStats = useAction(api.scrapedJobs.getFairChanceStats);
  const clearCache = useAction(api.scrapedJobs.clearCache);
  const nukeAllJobs = useAction(api.scrapedJobs.nukeAllJobs);
  const [nukeResult, setNukeResult] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cacheResult, fairChanceResult] = await Promise.all([
        getCacheStats(),
        getFairChanceStats(),
      ]);
      setStats(cacheResult as CacheStats);
      setFairChanceStats(fairChanceResult as FairChanceStats);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear ALL cache data? This cannot be undone.')) {
      return;
    }
    setLoading(true);
    setError(null);
    setClearResult(null);
    try {
      const result = await clearCache({ clearAll: true });
      setClearResult(`Cache cleared: ${JSON.stringify(result)}`);
      await fetchStats();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearByRange = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }
    if (!confirm(`Clear cache entries from ${startDate} to ${endDate}?`)) {
      return;
    }
    setLoading(true);
    setError(null);
    setClearResult(null);
    try {
      const result = await clearCache({ startDate, endDate });
      setClearResult(`Cleared ${(result as any).removedJobs} jobs (scanned ${(result as any).scanned})`);
      await fetchStats();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleNukeAll = async () => {
    if (!confirm(
      '⚠️ DANGER: This will DELETE ALL JOBS from:\n\n' +
      '• Convex database\n' +
      '• Typesense search index\n' +
      '• Redis dedup cache\n\n' +
      'This action CANNOT be undone.'
    )) {
      return;
    }

    const typed = prompt('Type "nuke" to confirm:');
    if (typed !== 'nuke') {
      alert('Cancelled - you must type "nuke" exactly');
      return;
    }

    setLoading(true);
    setError(null);
    setNukeResult(null);
    try {
      const result = await nukeAllJobs();
      setNukeResult(result.message);
      await fetchStats();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Redis Dedup Cache</h2>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh Stats'}
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {clearResult && (
        <div className="rounded border border-green-300 bg-green-50 p-4 text-green-700">
          {clearResult}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent>
              <h3 className="text-sm font-medium text-muted-foreground">Indexed Jobs</h3>
              <p className="mt-1 text-3xl font-semibold">{stats.indexedJobs.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <h3 className="text-sm font-medium text-muted-foreground">Cached Locations</h3>
              <p className="mt-1 text-3xl font-semibold">{stats.cachedLocations.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <h3 className="text-sm font-medium text-muted-foreground">Band Buckets</h3>
              <p className="mt-1 text-3xl font-semibold">{stats.bandBuckets.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {stats?.today && (
        <Card>
          <CardContent>
            <h3 className="mb-3 font-medium">Today's Activity</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-semibold">{stats.today.processed}</p>
                <p className="text-sm text-muted-foreground">Processed</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-orange-600">{stats.today.duplicates}</p>
                <p className="text-sm text-muted-foreground">Duplicates</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-green-600">{stats.today.indexed}</p>
                <p className="text-sm text-muted-foreground">Indexed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {fairChanceStats && (
        <Card>
          <CardContent>
            <h3 className="mb-3 font-medium">Fair Chance Employers (Redis)</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-semibold">{fairChanceStats.totalEmployers}</p>
                <p className="text-sm text-muted-foreground">Total Employers</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-green-600">{fairChanceStats.employersSeenToday}</p>
                <p className="text-sm text-muted-foreground">Seen Today</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-orange-600">
                  {fairChanceStats.employersStale30Days + fairChanceStats.employersStale60Days}
                </p>
                <p className="text-sm text-muted-foreground">Stale (30d+)</p>
              </div>
            </div>
            {fairChanceStats.newestLastSeen && (
              <p className="mt-2 text-xs text-muted-foreground">
                Last updated: {new Date(fairChanceStats.newestLastSeen).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <h3 className="mb-4 font-medium">Clear Cache</h3>

          <div className="mb-4 space-y-4">
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 border px-3 py-2"
                />
              </div>
              <button
                onClick={handleClearByRange}
                disabled={loading || !startDate || !endDate}
                className="bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
              >
                Clear Date Range
              </button>
            </div>
          </div>

          <div className="border-t pt-4">
            <button
              onClick={handleClearAll}
              disabled={loading}
              className="bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
            >
              Clear All Cache
            </button>
            <p className="mt-2 text-sm text-muted-foreground">
              Warning: This will clear all deduplication data. Jobs may be re-indexed as duplicates.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dev-only nuke button */}
      {import.meta.env.DEV && (
        <Alert variant="destructive" className="border-2">
          <h3 className="mb-2 font-medium text-red-700">☢️ Development Only</h3>
          <p className="mb-4 text-sm text-red-600">
            Nuke ALL jobs from Convex, Typesense, and Redis. This cannot be undone.
          </p>
          {nukeResult && (
            <div className="mb-4 border border-green-300 bg-green-50 p-2 text-green-700">
              {nukeResult}
            </div>
          )}
          <button
            onClick={handleNukeAll}
            disabled={loading}
            className="bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            ☢️ NUKE ALL JOBS
          </button>
        </Alert>
      )}
    </div>
  );
}
