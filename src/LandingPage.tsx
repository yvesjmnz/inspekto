import { Link } from 'react-router-dom';
import { FileText, Search } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex flex-col">
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-xl border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-8 py-10 sm:py-12 flex items-center gap-8 sm:gap-10 animate-fade-in">
          <img
            src="/logo.png"
            alt="Inspekto Logo"
            className="h-24 sm:h-28 lg:h-32 w-24 sm:w-28 lg:w-32 object-contain drop-shadow-lg flex-shrink-0"
          />
          <div className="flex-1">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">Inspekto</h1>
            <p className="mt-2 sm:mt-3 text-slate-300 text-base sm:text-lg lg:text-xl font-medium tracking-wide">
              Official Complaint Management System
            </p>
          </div>
        </div>
      </header>

      {/* Layout: keep content vertically centered, but slightly left of center */}
      <main className="flex-1 min-h-0">
        <div className="h-full grid grid-cols-12">
          {/* Left spacer */}
          <div className="hidden lg:block lg:col-span-3" />

          {/* Content */}
          <div className="col-span-12 lg:col-span-6 flex items-center">
            <section className="w-full px-8 py-12 lg:py-0">
              <div className="mx-auto max-w-3xl lg:mx-0">
                <h2 className="text-center lg:text-left text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight">
                  <span className="font-extrabold">Inspekto Complaint</span>
                  <br />
                  <span className="font-extrabold">Management System</span>
                </h2>

                <p className="mt-6 text-center lg:text-left text-slate-600 text-lg leading-relaxed max-w-2xl lg:max-w-none">
                  Submit your complaint through our secure platform, receive a unique tracking ID, and monitor the
                  progress of your case. All complaints are reviewed and processed according to regulatory standards.
                </p>

                <div className="mt-10 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 sm:gap-5">
                  <Link
                    to="/complaints/submit"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-full border border-red-300/70 bg-white/30 px-7 py-4 text-base font-semibold text-red-700 backdrop-blur-md shadow-sm hover:bg-red-50/40 hover:border-red-400/80 transition-colors"
                  >
                    <FileText className="h-5 w-5" />
                    Submit a Complaint
                  </Link>

                  <Link
                    to="/tracking"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-full border border-blue-300/70 bg-white/30 px-7 py-4 text-base font-semibold text-blue-700 backdrop-blur-md shadow-sm hover:bg-blue-50/40 hover:border-blue-400/80 transition-colors"
                  >
                    <Search className="h-5 w-5" />
                    Tracking
                  </Link>
                </div>
              </div>
            </section>
          </div>

          {/* Right spacer */}
          <div className="hidden lg:block lg:col-span-3" />
        </div>
      </main>
    </div>
  );
}
