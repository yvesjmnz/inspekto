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

        <nav className="hidden sm:flex items-center pl-6">
          <Link
            to="/"
            className="group inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-slate-900 bg-white shadow-sm hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4 mr-2 text-slate-700 group-hover:-translate-x-0.5 transition-transform" />
            Home
          </Link>
        </nav>
      </div>
    </header>
  );
}

