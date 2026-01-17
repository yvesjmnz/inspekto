import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Button } from '../ui/Button'
import { ComplaintsHeader } from '../ui/ComplaintsHeader'
import { CheckCircle, Copy, ArrowRight } from 'lucide-react'

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
      <ComplaintsHeader subtitle="Complaint Confirmation" />

      {/* Main */}
      <main className="flex justify-center px-6 sm:px-10 lg:px-16 py-12 sm:py-16">
        <div className="w-full max-w-5xl">
          {!complaintId ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-10 lg:p-12 animate-fade-in-slow">
              <h2 className="text-2xl font-bold text-slate-900">Confirmation unavailable</h2>
              <p className="mt-3 text-slate-600">
                This page requires a valid complaint ID.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link to="/complaints/submit">
                  <Button size="lg">Submit complaint</Button>
                </Link>
                <Link to="/">
                  <Button size="lg" variant="secondary">Back home</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-fade-in-slow">
              {/* Top gradient accent */}
              <div className="h-2 bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500" />

              <div className="p-8 sm:p-10 lg:p-14">
                {/* Success */}
                <div className="text-center">
                  <div className="mx-auto mb-6 relative h-20 w-20">
                    <div className="absolute inset-0 rounded-full bg-emerald-200/60 blur-md animate-pulse" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 ring-1 ring-emerald-200">
                      <CheckCircle className="h-10 w-10 text-emerald-700" />
                    </div>
                  </div>

                  <h2 className="text-4xl font-bold text-slate-900 tracking-tight animate-slide-up">
                    Complaint submitted
                  </h2>
                  <p className="mt-4 text-lg text-slate-600 animate-slide-up">
                    Save your tracking ID. You’ll need it to check progress.
                  </p>
                </div>

                {/* Tracking ID */}
                <div className="mt-12 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8 lg:p-10">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                        Tracking ID
                      </p>
                      <p className="mt-3 text-2xl sm:text-3xl font-mono font-bold tracking-wider text-slate-900 break-all">
                        {complaintId}
                      </p>
                      {email && (
                        <p className="mt-4 text-sm text-slate-600">
                          A confirmation email was sent to{' '}
                          <span className="font-semibold text-slate-900">{maskEmail(email)}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:items-end">
                      <Link to={trackingLink}>
                        <Button size="lg" className="w-full sm:w-auto">
                          Track complaint
                          <ArrowRight className="h-4 w-4 ml-2 inline-block" />
                        </Button>
                      </Link>

                      <Button
                        size="lg"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={() => void copyId()}
                      >
                        <Copy className="h-4 w-4 mr-2 inline-block" />
                        {copied ? 'Copied' : 'Copy ID'}
                      </Button>

                      {copied && (
                        <div className="text-xs font-semibold text-emerald-700 animate-fade-in">
                          Tracking ID copied to clipboard
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Next steps */}
                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Next</div>
                    <div className="mt-2 text-sm text-slate-700">
                      Use the tracking page to see status updates.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Tip</div>
                    <div className="mt-2 text-sm text-slate-700">
                      Keep this ID somewhere safe or copy it into your notes.
                    </div>
                  </div>
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
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
