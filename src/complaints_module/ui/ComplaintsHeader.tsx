import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * ComplaintsHeader
 * Shared header aligned with SubmitComplaintPage.tsx.
 * Keeps navigation consistent across complaints-related pages.
 */
export function ComplaintsHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-xl border-b border-slate-700">
      <div className="w-full px-10 sm:px-14 lg:px-22 py-8 sm:py-10 flex items-center justify-between gap-8 animate-fade-in">
        <Link to="/" className="flex items-center gap-10 sm:gap-12 lg:gap-14 min-w-0">
          <img
            src="/logo.png"
            alt="Inspekto Logo"
            className="h-20 sm:h-24 lg:h-28 w-20 sm:w-24 lg:w-28 object-contain drop-shadow-lg flex-shrink-0"
          />

          <div className="min-w-0 flex flex-col space-y-1 sm:space-y-2">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">
              Inspekto
            </h1>
            <p className="text-slate-300 text-base sm:text-lg lg:text-xl font-medium tracking-wide">
              {subtitle ?? 'Official Complaint Management System'}
            </p>
          </div>
        </Link>

        {/* Intentionally no right-side navigation; logo click returns home */}
      </div>
    </header>
  );
}

