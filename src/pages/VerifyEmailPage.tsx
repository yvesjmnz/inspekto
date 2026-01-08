import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-slate-200 p-10">
        <h1 className="text-3xl font-bold text-slate-900">Email verification</h1>

        {status.kind === 'verifying' && (
          <p className="mt-4 text-slate-600">Verifying your email, please wait.</p>
        )}

        {status.kind === 'success' && (
          <div className="mt-6 p-5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-emerald-800 font-medium">Email verified. Redirecting to complaint form.</p>
          </div>
        )}

        {status.kind === 'error' && (
          <div className="mt-6 p-5 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">{status.message}</p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Back to submit complaint
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
