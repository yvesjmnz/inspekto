import { useMemo, useState } from 'react'
import { ComplaintForm } from '..'
import { supabase } from '../../supabaseClient'

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

  const [useVerifiedEmailForForm, setUseVerifiedEmailForForm] = useState(true)

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
            <p className="mt-2 sm:mt-3 text-slate-300 text-base sm:text-lg lg:text-xl font-medium tracking-wide">Official Complaint Management System</p>
          </div>
        </div>
      </header>

      <main className="w-full px-8 py-12 flex justify-center">
        <div className="w-full max-w-6xl">
          {!canAccessForm ? (
            <section className="bg-white rounded-xl shadow-2xl border border-slate-200 p-12 animate-fade-in-up">
              <div className="mb-8 pb-8 border-b-2 border-slate-200">
                <h2 className="text-4xl font-bold text-slate-900 tracking-tight">Email Verification</h2>
                <p className="mt-3 text-slate-600 text-lg">
                  Verify your email address to proceed with complaint submission. This protects your identity and ensures secure communication.
                </p>
              </div>

              <div className="mt-10">
                <label className="block text-base font-semibold text-slate-900 mb-4 uppercase tracking-wide">Email Address</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-6 py-4 border-2 border-slate-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition duration-300 font-medium bg-white hover:border-slate-400"
                />

                <button
                  onClick={requestVerification}
                  disabled={status.kind === 'sending'}
                  className="mt-8 w-full bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg text-lg transition duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                >
                  {status.kind === 'sending' ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending verification link...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Verification Link
                    </>
                  )}
                </button>

                {status.kind === 'sent' && (
                  <div className="mt-8 p-6 bg-emerald-50 border-l-4 border-emerald-600 rounded-lg animate-slide-in-left shadow-md">
                    <div className="flex gap-4">
                      <svg className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-base text-emerald-900 font-bold">Verification email sent</p>
                        <p className="mt-2 text-sm text-emerald-800">
                          Check your inbox for the verification link. If you don't see it within a few minutes, please check your spam folder.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {status.kind === 'error' && (
                  <div className="mt-8 p-6 bg-red-50 border-l-4 border-red-600 rounded-lg animate-slide-in-left shadow-md">
                    <div className="flex gap-4">
                      <svg className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-base text-red-900 font-bold">Verification failed</p>
                        <p className="mt-1 text-sm text-red-800">{status.message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="animate-fade-in-up">
              <div className="mb-8 bg-white rounded-xl shadow-lg border border-slate-200 p-8 md:p-10 transform hover:shadow-xl transition duration-300">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Verified Email Address</p>
                    <p className="text-xl font-bold text-slate-900 break-all mt-2">{verifiedEmail}</p>

                    <label className="mt-5 flex items-center gap-3 text-sm font-semibold text-slate-800 select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={useVerifiedEmailForForm}
                        onChange={(e) => setUseVerifiedEmailForForm(e.target.checked)}
                      />
                      Use this email for the complaint form
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={clearVerification}
                      className="text-sm font-bold text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-100 transition duration-200 whitespace-nowrap"
                    >
                      Change Email
                    </button>
                  </div>
                </div>
              </div>

              <ComplaintForm prefillEmail={useVerifiedEmailForForm ? verifiedEmail ?? undefined : undefined} />
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
