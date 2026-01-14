import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Button } from '../ui/Button'
import { CheckCircle, Copy } from 'lucide-react'

type LocationState = {
  complaintId?: string
  email?: string
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  const visible = name.length <= 2 ? name[0] ?? '' : name.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(1, name.length - visible.length))}@${domain}`
}

export default function ComplaintConfirmationPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const state = (location.state || {}) as LocationState

  const complaintId = state.complaintId || searchParams.get('id') || undefined
  const email = state.email

  const [copied, setCopied] = useState(false)

  const trackingLink = useMemo(() => {
    if (!complaintId) return '/tracking'
    return `/tracking?id=${encodeURIComponent(complaintId)}`
  }, [complaintId])

  const copyId = async () => {
    if (!complaintId) return
    await navigator.clipboard.writeText(complaintId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-4">
            <img src="/logo.png" alt="Inspekto" className="h-14 w-14 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-white">Inspekto</h1>
              <p className="text-sm text-slate-300">Complaint Confirmation</p>
            </div>
          </Link>

          <div className="hidden sm:flex gap-3">
            <Link to="/tracking" className="text-sm font-semibold text-slate-300 hover:text-white">
              Tracking
            </Link>
            <Link to="/complaints/submit" className="text-sm font-semibold text-slate-300 hover:text-white">
              Submit Complaint
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex justify-center px-6 py-16">
        <div className="w-full max-w-3xl">
          {!complaintId ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-10">
              <h2 className="text-2xl font-bold text-slate-900">Confirmation unavailable</h2>
              <p className="mt-3 text-slate-600">
                This page requires a valid complaint ID.
              </p>
              <div className="mt-8 flex gap-4">
                <Link to="/complaints/submit">
                  <Button size="lg">Submit complaint</Button>
                </Link>
                <Link to="/">
                  <Button size="lg" variant="secondary">Back home</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-12">
              {/* Success */}
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle className="h-8 w-8 text-emerald-700" />
                </div>

                <h2 className="text-4xl font-bold text-slate-900">
                  Complaint submitted successfully
                </h2>
                <p className="mt-4 text-lg text-slate-600">
                  Keep your tracking ID safe. You’ll need it to check progress.
                </p>
              </div>

              {/* Tracking ID */}
              <div className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Tracking ID
                </p>

                <p className="mt-4 text-4xl font-mono font-bold tracking-wider text-slate-900 break-all">
                  {complaintId}
                </p>

                <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                  <Link to={trackingLink}>
                    <Button size="lg">Track complaint</Button>
                  </Link>

                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => void copyId()}
                  >
                    <Copy className="h-4 w-4 mr-2 inline-block" />
                    {copied ? 'Copied' : 'Copy ID'}
                  </Button>
                </div>

                {email && (
                  <p className="mt-6 text-sm text-slate-600">
                    A confirmation email was sent to{' '}
                    <span className="font-semibold text-slate-900">
                      {maskEmail(email)}
                    </span>
                  </p>
                )}
              </div>

              {/* Footer actions */}
              <div className="mt-12 flex flex-col sm:flex-row justify-center gap-4">
                <Link to="/complaints/submit">
                  <Button size="lg">Submit another complaint</Button>
                </Link>
                <Link to="/">
                  <Button size="lg" variant="secondary">Back to home</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
