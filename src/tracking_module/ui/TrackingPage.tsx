import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../complaints_module/ui/Button';
import { Alert } from '../../complaints_module/ui/Alert';
import { getTrackingSummary } from '../service';
import type { TrackingSummary } from '../types';

function StatusBadge({ status }: { status: string }) {
  const tone = useMemo(() => {
    const s = status.toLowerCase();
    if (s.includes('complete') || s.includes('resolved') || s.includes('transmitted')) return 'emerald';
    if (s.includes('progress') || s.includes('inspect')) return 'amber';
    if (s.includes('approve') || s.includes('review')) return 'sky';
    return 'slate';
  }, [status]);

  const cls =
    tone === 'emerald'
      ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
      : tone === 'amber'
        ? 'bg-amber-50 border-amber-600 text-amber-900'
        : tone === 'sky'
          ? 'bg-sky-50 border-sky-600 text-sky-900'
          : 'bg-slate-50 border-slate-600 text-slate-900';

  return (
    <span className={`inline-flex items-center rounded-lg border-l-4 px-4 py-2 text-sm font-bold ${cls}`}>
      {status || '—'}
    </span>
  );
}

export function TrackingPage() {
  const [searchParams] = useSearchParams();
  const [trackingId, setTrackingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (idRaw: string) => {
    const id = idRaw.trim();
    if (!id) {
      setError('Please enter a tracking ID.');
      return;
    }

    setLoading(true);
    const summary = await getTrackingSummary(id);
    setLoading(false);

    if (!summary) {
      setError('Tracking ID not found.');
      return;
    }

    setResult(summary);
  };

  useEffect(() => {
    const id = (searchParams.get('id') || '').trim();
    if (!id) return;
    setTrackingId(id);
    setError(null);
    setResult(null);
    void lookup(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    await lookup(trackingId);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex flex-col gap-8">
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-xl border-b border-slate-700">
        <div className="w-full px-6 sm:px-10 lg:px-16 py-10 sm:py-12 flex items-center justify-between gap-8 sm:gap-10 animate-fade-in">
          <Link
            to="/"
            className="flex items-center gap-8 sm:gap-10 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg"
          >
            <img
              src="/logo.png"
              alt="Inspekto Logo"
              className="h-20 sm:h-24 lg:h-28 w-20 sm:w-24 lg:w-28 object-contain drop-shadow-lg flex-shrink-0 transform hover:scale-110 transition-transform duration-300"
            />
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">Inspekto</h1>
              <p className="mt-2 text-slate-300 text-sm sm:text-base lg:text-lg font-medium tracking-wide">Tracking Portal</p>
            </div>
          </Link>

          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/complaints/submit"
              className="text-sm font-bold text-slate-200 hover:text-white px-4 py-2 rounded-lg hover:bg-white/10 transition duration-200 whitespace-nowrap"
            >
              Submit Complaint
            </Link>
          </div>
        </div>
      </header>

      <main className="w-full px-8 py-12 flex justify-center">
        <div className="w-full max-w-6xl">
          <section className="bg-white rounded-xl shadow-2xl border border-slate-200 p-10 md:p-12 animate-fade-in-up">
            <div className="mb-8 pb-8 border-b-2 border-slate-200">
              <h2 className="text-4xl font-bold text-slate-900 tracking-tight">Track Your Complaint</h2>
              <p className="mt-3 text-slate-600 text-lg">
                Enter your Tracking ID to view the latest status as recorded in the system.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <label className="block text-base font-semibold text-slate-900 mb-4 uppercase tracking-wide">Tracking ID</label>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    placeholder="Enter Tracking ID"
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                    className="w-full flex-1 px-6 py-4 border-2 border-slate-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition duration-300 font-medium bg-white hover:border-slate-400"
                  />

                  <Button type="submit" size="lg" disabled={loading}>
                    {loading ? 'Checking…' : 'Track'}
                  </Button>
                </div>

                <div className="mt-3 text-sm text-slate-600">
                  The Tracking ID is the ID you received after submitting your complaint.
                </div>
              </div>

              {error && (
                <Alert kind="error" title="Tracking failed" message={error} />
              )}
            </form>

            {result && (
              <div className="mt-10 bg-white rounded-xl shadow-lg border border-slate-200 p-8 md:p-10 transform hover:shadow-xl transition duration-300">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Tracking ID</p>
                    <p className="text-xl font-bold text-slate-900 break-all mt-2 font-mono">{result.trackingId}</p>
                  </div>

                  <div className="md:text-right">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Current Status</p>
                    <div className="mt-3">
                      <StatusBadge status={result.status} />
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-sm text-slate-600">
                  Status is updated by the receiving office as the complaint progresses.
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default TrackingPage;
