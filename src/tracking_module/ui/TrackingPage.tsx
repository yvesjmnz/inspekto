import { useState } from 'react';
import { getTrackingSummary } from '../service';
import type { TrackingSummary } from '../types';

export function TrackingPage() {
  const [trackingId, setTrackingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const id = trackingId.trim();
    if (!id) {
      setError('Please enter a tracking ID.');
      return;
    }
    setLoading(true);
    const summary = await getTrackingSummary(id);
    setLoading(false);
    if (!summary) {
      setError('Tracking ID not found.');
    } else {
      setResult(summary);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Track Your Complaint</h1>
      <form onSubmit={onSubmit} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Enter Tracking ID"
          value={trackingId}
          onChange={(e) => setTrackingId(e.target.value)}
          className="flex-1 border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {loading ? 'Checking…' : 'Track'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded mb-4">{error}</div>
      )}

      {result && (
        <div className="border rounded p-4 space-y-2">
          <div className="text-sm text-gray-600">Tracking ID</div>
          <div className="font-mono">{result.trackingId}</div>

          <div className="text-sm text-gray-600 mt-4">Current Status</div>
          <div className="text-lg font-semibold">{result.status || '—'}</div>
        </div>
      )}
    </div>
  );
}

export default TrackingPage;
