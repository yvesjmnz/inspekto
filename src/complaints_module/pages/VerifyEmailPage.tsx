import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'

const VERIFIED_EMAIL_STORAGE_KEY = 'inspekto_verified_email'

type Status =
  | { kind: 'verifying' }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>({ kind: 'verifying' })

  const token = useMemo(() => params.get('token') || '', [params])

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus({ kind: 'error', message: 'Missing token.' })
        return
      }

      const { data, error } = await supabase.functions.invoke('verify-email', {
        body: { token },
      })

      if (error) {
        setStatus({ kind: 'error', message: error.message || 'Verification failed.' })
        return
      }

      const email = (data as { email?: string } | null)?.email
      if (email) {
        localStorage.setItem(VERIFIED_EMAIL_STORAGE_KEY, email)
      }

      setStatus({ kind: 'success' })

      // redirect back to main page after a moment
      setTimeout(() => navigate('/', { replace: true }), 800)
    }

    run()
  }, [navigate, token])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-start justify-center px-6 py-12">
      <div className="w-full max-w-4xl">
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-12 md:p-16 animate-fade-in-up">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Email Verification</h1>
            <p className="mt-3 text-slate-600 text-lg">Processing your verification request</p>
          </div>

          {status.kind === 'verifying' && (
            <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
              <div className="relative w-16 h-16 mb-6">
                <svg className="animate-spin text-slate-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="text-center text-slate-700 font-medium text-lg">Verifying your email address...</p>
              <p className="text-center text-slate-500 text-sm mt-3">This may take a few moments</p>
            </div>
          )}

          {status.kind === 'success' && (
            <div className="animate-slide-in-left">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-200 rounded-full animate-pulse"></div>
                  <svg className="relative h-16 w-16 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="bg-emerald-50 border-l-4 border-emerald-600 rounded-lg p-6 mb-6">
                <p className="text-emerald-900 font-bold text-lg text-center">Email verified successfully</p>
                <p className="text-emerald-800 text-sm text-center mt-2">Redirecting to complaint form...</p>
              </div>
            </div>
          )}

          {status.kind === 'error' && (
            <div className="animate-slide-in-left">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-red-200 rounded-full animate-pulse"></div>
                  <svg className="relative h-16 w-16 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="bg-red-50 border-l-4 border-red-600 rounded-lg p-6 mb-6">
                <p className="text-red-900 font-bold text-lg">Verification failed</p>
                <p className="text-red-800 text-sm mt-2">{status.message}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/', { replace: true })}
                className="w-full bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-bold py-3 px-6 rounded-lg transition duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Return to Complaint Form
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
