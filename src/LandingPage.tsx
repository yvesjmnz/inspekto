import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full">
        <h1 className="text-3xl font-bold mb-2">Inspekto</h1>
        <p className="text-gray-600 mb-8">
          Choose an option below to submit a new complaint or track an existing one.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/complaints/submit"
            className="border rounded-lg p-5 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div className="text-lg font-semibold mb-1">Submit Complaint</div>
            <div className="text-sm text-gray-600">File a new complaint and receive a tracking ID.</div>
          </Link>

          <Link
            to="/tracking"
            className="border rounded-lg p-5 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div className="text-lg font-semibold mb-1">Tracking</div>
            <div className="text-sm text-gray-600">View the current status of your filed complaint.</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
