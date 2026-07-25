import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router'
import { toast } from 'sonner'
import { AuthLayout } from '../components/auth/AuthLayout'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'

const RESEND_COOLDOWN_SECONDS = 60

export default function VerifyEmailPage() {
  const { verifyOtp, resendOtp, pendingVerificationEmail } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const email = location.state?.email || pendingVerificationEmail || ''

  const [otp, setOtp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!email) {
      // Nothing to verify and nowhere to send a resend — bounce to signup.
      navigate('/signup', { replace: true })
    }
  }, [email, navigate])

  useEffect(() => {
    if (cooldown <= 0) return
    timerRef.current = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [cooldown])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (otp.trim().length !== 6) {
      toast.error('Enter the 6-digit code from your email.')
      return
    }
    setSubmitting(true)
    try {
      const user = await verifyOtp(email, otp.trim())
      toast.success(`Welcome, ${user.name.split(' ')[0]}.`)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      const message = error?.response?.data?.message || 'That code is incorrect or expired.'
      toast.error(typeof message === 'string' ? message : 'That code is incorrect or expired.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await resendOtp(email)
      toast.success('A new code is on its way.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch {
      toast.error('Could not resend the code. Try again shortly.')
    } finally {
      setResending(false)
    }
  }

  if (!email) return null

  return (
    <AuthLayout
      title="Check your email"
      description={`Enter the 6-digit code we sent to ${email}.`}
      footer={
        <>
          Wrong email?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Start over
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">Verification code</label>
          <Input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="text-center text-lg tracking-[0.5em]"
            maxLength={6}
            required
            autoFocus
          />
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? 'Verifying…' : 'Verify email'}
        </Button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="w-full text-center text-xs text-ink-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? 'Sending…' : "Didn't get a code? Resend"}
        </button>
      </form>
    </AuthLayout>
  )
}
