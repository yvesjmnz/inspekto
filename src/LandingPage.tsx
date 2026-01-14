import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Search } from 'lucide-react';

function OptionCard(props: {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: 'blue' | 'emerald';
  note?: string;
}) {

  const colorClasses = {
    blue: {
      icon: 'bg-gradient-to-br from-blue-500 to-blue-600',
      border: 'hover:border-blue-300',
      text: 'text-blue-600',
      bar: 'bg-gradient-to-r from-blue-500 to-blue-600',
      ring: 'focus:ring-blue-500',
    },
    emerald: {
      icon: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      border: 'hover:border-emerald-300',
      text: 'text-emerald-600',
      bar: 'bg-gradient-to-r from-emerald-500 to-emerald-600',
      ring: 'focus:ring-emerald-500',
    }
  };

  const colors = colorClasses[props.color];

  return (
    <Link
      to={props.to}
      className={`group bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden cursor-pointer border border-slate-200 ${colors.border} focus:outline-none focus:ring-2 focus:ring-offset-2 ${colors.ring}`}
    >
      <div className="p-8">
        {/* Icon */}
        <div className={`inline-flex items-center justify-center w-16 h-16 ${colors.icon} rounded-xl shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300`}>
          {props.icon}
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-slate-900 mb-3">
          {props.title}
        </h3>

        {/* Description */}
        <p className="text-slate-600 mb-2 leading-relaxed">
          {props.description}
        </p>

        {/* Action Link */}
        <div className={`mt-6 flex items-center gap-2 ${colors.text} font-semibold group-hover:gap-4 transition-all duration-300`}>
          <span>Open</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </div>

        {/* Bottom Note */}
        {props.note !== undefined && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              {props.note || '\u00A0'}
            </p>
          </div>
        )}
      </div>

      {/* Hover Effect Overlay */}
      <div className={`h-1.5 ${colors.bar} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`} />
    </Link>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-xl border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-8 py-10 sm:py-12 flex items-center gap-8 sm:gap-10 animate-fade-in">
          <img
            src="/logo.png"
            alt="Inspekto Logo"
            className="h-24 sm:h-28 lg:h-32 w-24 sm:w-28 lg:w-32 object-contain drop-shadow-lg flex-shrink-0 transform hover:scale-110 transition-transform duration-300"
          />
          <div className="flex-1">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight">Inspekto</h1>
            <p className="mt-2 sm:mt-3 text-slate-300 text-base sm:text-lg lg:text-xl font-medium tracking-wide">
              Official Complaint Management System
            </p>
          </div>
        </div>
      </header>

      <main className="px-8 py-16">
        {/* Welcome Section */}
        <div className="text-center mb-16 animate-fade-in-up">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Welcome
          </h2>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Choose an option below to submit a new complaint or track an existing one.
          </p>
        </div>

        {/* Action Cards - Using OptionCard pattern */}
        <div className="grid gap-6 md:grid-cols-2">
          <OptionCard
            to="/complaints/submit"
            title="Submit Complaint"
            description="File a new complaint and receive a Tracking ID for future updates."
            icon={<FileText className="w-8 h-8 text-white" />}
            color="blue"
            note="Keep your Tracking ID safe—you'll need it to check status updates."
          />

          <OptionCard
            to="/tracking"
            title="Tracking"
            description="Enter your Tracking ID to view the current complaint status."
            icon={<Search className="w-8 h-8 text-white" />}
            color="emerald"
            note=""
          />
        </div>

        {/* Additional Info Banner */}
        <div className="mt-16 bg-gradient-to-r from-blue-50 to-slate-50 rounded-2xl border border-blue-100 p-8 shadow-md">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">
                How It Works
              </h4>
              <p className="text-slate-600 text-sm leading-relaxed">
                Submit your complaint through our secure platform, receive a unique tracking ID, and monitor the progress of your case. 
                All complaints are reviewed and processed according to regulatory standards.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
