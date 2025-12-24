import { useAction } from 'convex/react';
import { useState } from 'react';
import { api } from '../../../convex/_generated/api';

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

export function CacheManagement() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clearResult, setClearResult] = useState<string | null>(null);

  const getCacheStats = useAction(api.scrapedJobs.getCacheStats);
  const clearCache = useAction(api.scrapedJobs.clearCache);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCacheStats();
      setStats(result as CacheStats);
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
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Indexed Jobs</h3>
            <p className="mt-1 text-3xl font-semibold">{stats.indexedJobs.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Cached Locations</h3>
            <p className="mt-1 text-3xl font-semibold">{stats.cachedLocations.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Band Buckets</h3>
            <p className="mt-1 text-3xl font-semibold">{stats.bandBuckets.toLocaleString()}</p>
          </div>
        </div>
      )}

      {stats?.today && (
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-medium">Today's Activity</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold">{stats.today.processed}</p>
              <p className="text-sm text-gray-500">Processed</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-orange-600">{stats.today.duplicates}</p>
              <p className="text-sm text-gray-500">Duplicates</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-green-600">{stats.today.indexed}</p>
              <p className="text-sm text-gray-500">Indexed</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-4 font-medium">Clear Cache</h3>

        <div className="mb-4 space-y-4">
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 rounded border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 rounded border px-3 py-2"
              />
            </div>
            <button
              onClick={handleClearByRange}
              disabled={loading || !startDate || !endDate}
              className="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
            >
              Clear Date Range
            </button>
          </div>
        </div>

        <div className="border-t pt-4">
          <button
            onClick={handleClearAll}
            disabled={loading}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Clear All Cache
          </button>
          <p className="mt-2 text-sm text-gray-500">
            Warning: This will clear all deduplication data. Jobs may be re-indexed as duplicates.
          </p>
        </div>
      </div>
    </div>
  );
}
