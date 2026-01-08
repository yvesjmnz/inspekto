import { useMemo, useState } from 'react'
import { ComplaintForm } from '../complaints_module'
import { supabase } from '../supabaseClient'

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'verified' }
  | { kind: 'error'; message: string }

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)
}

const VERIFIED_EMAIL_STORAGE_KEY = 'inspekto_verified_email'

export default function SubmitComplaintPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const verifiedEmail = useMemo(() => {
    const stored = localStorage.getItem(VERIFIED_EMAIL_STORAGE_KEY)
    return stored ? normalizeEmail(stored) : null
  }, [])

  const canAccessForm = verifiedEmail !== null

  const requestVerification = async () => {
    const normalized = normalizeEmail(email)
    if (!isValidEmail(normalized)) {
      setStatus({ kind: 'error', message: 'Please enter a valid email address.' })
      return
    }

    setStatus({ kind: 'sending' })

    const { error } = await supabase.functions.invoke('request-email-verification', {
      body: { email: normalized },
    })

    if (error) {
      setStatus({ kind: 'error', message: error.message || 'Failed to send verification email.' })
      return
    }

    setStatus({ kind: 'sent' })
  }

  const clearVerification = () => {
    localStorage.removeItem(VERIFIED_EMAIL_STORAGE_KEY)
    // reload to refresh memoized storage state
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 border-b-4 border-blue-500 shadow-2xl">
        <div className="w-full px-16 py-12 flex items-center gap-10">
          <img
            src="/logo.png"
            alt="Inspekto Logo"
            className="h-32 w-32 object-contain drop-shadow-lg flex-shrink-0"
          />
          <div>
            <h1 className="text-6xl font-bold text-white tracking-tight drop-shadow-lg">Inspekto</h1>
            <p className="mt-3 text-blue-100 text-xl font-light">Submit and manage your complaints</p>
          </div>
        </div>
      </header>

      <main className="w-full px-8 py-16 flex justify-center">
        <div className="w-full max-w-3xl">
          {!canAccessForm ? (
            <section className="bg-white rounded-2xl shadow-lg border border-slate-200 p-10">
              <h2 className="text-3xl font-bold text-slate-900">Submit a complaint</h2>
              <p className="mt-2 text-slate-600">
                To protect reporters, we verify your email before allowing complaint submission.
              </p>

              <div className="mt-8">
                <label className="block text-lg font-semibold text-slate-900 mb-3">Your email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-6 py-4 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition duration-200 font-medium border-slate-300"
                />

                <button
                  onClick={requestVerification}
                  disabled={status.kind === 'sending'}
                  className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg text-lg transition duration-200 shadow-sm hover:shadow-md"
                >
                  {status.kind === 'sending' ? 'Sending...' : 'Send verification link'}
                </button>

                {status.kind === 'sent' && (
                  <div className="mt-6 p-5 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-base text-blue-900 font-medium">
                      Verification email sent. Check your inbox and click the link to continue.
                    </p>
                    <p className="mt-1 text-sm text-blue-800">
                      If you do not see it, check spam. You can request another link after a short delay.
                    </p>
                  </div>
                )}

                {status.kind === 'error' && (
                  <div className="mt-6 p-5 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-base text-red-800 font-medium">{status.message}</p>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section>
              <div className="mb-6 bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Verified email</p>
                    <p className="text-lg font-semibold text-slate-900 break-all">{verifiedEmail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearVerification}
                    className="text-sm font-semibold text-red-600 hover:text-red-700"
                  >
                    Use a different email
                  </button>
                </div>
              </div>

              <ComplaintForm />
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
