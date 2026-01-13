import { Link } from 'react-router-dom';

function OptionCard(props: {
  to: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={props.to}
      className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 md:p-10 transform hover:shadow-xl transition duration-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{props.title}</h2>
      <p className="mt-2 text-slate-600 text-base leading-relaxed">{props.description}</p>
      <div className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-slate-800">
        Open
        <span aria-hidden="true">→</span>
      </div>
    </Link>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-xl border-b border-slate-700">
        <div className="w-full px-6 sm:px-10 lg:px-16 py-10 sm:py-12 flex items-center gap-8 sm:gap-10 animate-fade-in">
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

      <main className="w-full px-8 py-12 flex justify-center">
        <div className="w-full max-w-6xl">
          <section className="bg-white rounded-xl shadow-2xl border border-slate-200 p-10 md:p-12 animate-fade-in-up">
            <div className="mb-8 pb-8 border-b-2 border-slate-200">
              <h2 className="text-4xl font-bold text-slate-900 tracking-tight">Welcome</h2>
              <p className="mt-3 text-slate-600 text-lg">
                Choose an option below to submit a new complaint or track an existing one.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <OptionCard
                to="/complaints/submit"
                title="Submit Complaint"
                description="File a new complaint and receive a Tracking ID for future updates."
              />

              <OptionCard
                to="/tracking"
                title="Tracking"
                description="Enter your Tracking ID to view the current complaint status."
              />
            </div>

            <div className="mt-8 text-sm text-slate-600">
              Keep your Tracking ID safe—you’ll need it to check status updates.
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
