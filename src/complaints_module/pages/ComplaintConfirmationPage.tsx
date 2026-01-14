import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Button } from '../ui/Button'

type LocationState = {
  complaintId?: string
  email?: string
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
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

  const canRender = Boolean(complaintId)

  const [copied, setCopied] = useState(false)

  const trackingLink = useMemo(() => {
    if (!complaintId) return '/tracking'
    return `/tracking?id=${encodeURIComponent(complaintId)}`
  }, [complaintId])

  const copyId = async () => {
    if (!complaintId) return
    try {
      await navigator.clipboard.writeText(complaintId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be blocked; ignore
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-xl border-b border-slate-700">
        <div className="w-full px-6 sm:px-10 lg:px-16 py-8 sm:py-10 flex items-center justify-between gap-8 animate-fade-in">
          <Link to="/" className="flex items-center gap-8 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg">
            <img
              src="/logo.png"
              alt="Inspekto Logo"
              className="h-20 sm:h-24 w-20 sm:w-24 object-contain drop-shadow-lg flex-shrink-0"
            />
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Inspekto</h1>
              <p className="mt-2 text-slate-300 text-base sm:text-lg font-medium tracking-wide">Complaint Confirmation</p>
            </div>
          </Link>

          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/tracking"
              className="text-sm font-bold text-slate-200 hover:text-white px-4 py-2 rounded-lg hover:bg-white/10 transition duration-200 whitespace-nowrap"
            >
              Tracking
            </Link>
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
        <div className="w-full max-w-4xl">
          {!canRender ? (
            <section className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 animate-fade-in-up">
              <h2 className="text-3xl font-bold text-slate-900">Confirmation unavailable</h2>
              <p className="mt-3 text-slate-600 text-lg">
                This page needs a complaint ID. If you just submitted a complaint, return to the submission page and try again.
              </p>
              <div className="mt-8 flex gap-4">
                <Link to="/complaints/submit">
                  <Button size="lg">Go to submission</Button>
                </Link>
                <Link to="/">
                  <Button variant="secondary" size="lg">Back to landing</Button>
                </Link>
              </div>
            </section>
          ) : (
            <section className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 animate-fade-in-up">
              <div className="text-center">
                <h2 className="text-4xl font-bold text-slate-900 tracking-tight">Complaint submitted</h2>
                <p className="mt-3 text-slate-600 text-lg">Save your tracking ID to track status updates.</p>
              </div>

              <div className="mt-10 flex justify-center">
                <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-8">
                  <div className="text-sm font-bold text-slate-600 uppercase tracking-widest">Tracking ID</div>
                  <div className="mt-4 text-4xl sm:text-5xl font-bold text-slate-900 font-mono tracking-wider break-all">
                    {complaintId}
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to={trackingLink}>
                      <Button size="lg">Go to tracking</Button>
                    </Link>
                    <Button type="button" variant="secondary" size="lg" onClick={() => void copyId()}>
                      {copied ? 'Copied' : 'Copy tracking ID'}
                    </Button>
                  </div>

                  {email && (
                    <div className="mt-6 text-sm text-slate-600 text-center">
                      A confirmation email with this tracking ID was sent to{' '}
                      <span className={cx('font-semibold', 'text-slate-900')}>{maskEmail(email)}</span>.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
                <Link to="/complaints/submit">
                  <Button size="lg">Submit another complaint</Button>
                </Link>
                <Link to="/">
                  <Button variant="secondary" size="lg">Back to landing</Button>
                </Link>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
