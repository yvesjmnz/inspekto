import { useMemo, useState } from 'react'
import { ComplaintForm } from '..'
import { ComplaintsHeader } from '../ui/ComplaintsHeader'
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex flex-col gap-8">
      <ComplaintsHeader subtitle="Official Complaint Management System" />

      <main className="w-full py-12 flex justify-center">
        <div className="mx-auto w-full max-w-6xl px-8 md:px-12">
          {!canAccessForm ? (
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>

              <h2 className="text-3xl font-semibold text-gray-900 text-center mb-3">Email Verification</h2>
              <p className="text-gray-600 text-center mb-8">
                Verify your email address to proceed with complaint submission. This protects your identity and ensures secure communication.
              </p>

              {status.kind === 'sent' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-green-900">Verification email sent</p>
                    <p className="text-sm text-green-700 mt-1">
                      Check your inbox for the verification link. If you don't see it within a few minutes, please check your spam folder.
                    </p>
                  </div>
                </div>
              )}

              {status.kind === 'error' && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-red-900">Verification failed</p>
                    <p className="text-sm text-red-700 mt-1">{status.message}</p>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">EMAIL ADDRESS</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={requestVerification}
                disabled={status.kind === 'sending'}
                className="w-full bg-[#1a5f5f] text-white py-3 rounded-lg font-medium hover:bg-[#164d4d] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-blue-600">i</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p className="font-medium text-gray-900 mb-1">Why verify your email?</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Confirms your identity for secure complaint submission</li>
                      <li>Enables us to send you updates about your case</li>
                      <li>Protects against unauthorized access to your complaints</li>
                    </ul>
                  </div>
                </div>
              </div>

              {status.kind === 'sent' && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Didn't receive the email?{' '}
                    <button
                      onClick={requestVerification}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Resend verification link
                    </button>
                  </p>
                </div>
              )}
            </section>
          ) : (
            <section>
              <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Verified Email Address</p>
                    </div>
                    <p className="text-lg font-semibold text-gray-900 break-all">{verifiedEmail}</p>

                    <label className="mt-4 flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
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
                      className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap"
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