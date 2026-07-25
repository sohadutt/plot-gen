import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { AuthLayout } from '../components/auth/AuthLayout'
import { PasswordInput } from '../components/auth/PasswordInput'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''

  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password', { replace: true })
    }
  }, [email, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (otp.trim().length !== 6) {
      toast.error('Enter the 6-digit code from your email.')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match.")
      return
    }

    setSubmitting(true)
    try {
      await resetPassword(email, otp.trim(), password)
      setDone(true)
    } catch (error) {
      const message = error?.response?.data?.message || 'That code is incorrect or has expired.'
      toast.error(typeof message === 'string' ? message : 'That code is incorrect or has expired.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!email) return null

  if (done) {
    return (
      <AuthLayout title="Password updated">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm text-ink-muted">Your password has been updated and you're signed in.</p>
          <Button variant="primary" className="w-full" onClick={() => navigate('/dashboard', { replace: true })}>
            Continue to dashboard
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Set a new password" description={`Enter the code we sent to ${email}, and choose a new password.`}>
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

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">New password</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">Confirm new password</label>
          <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
        </div>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? 'Updating…' : 'Update password'}
        </Button>

        <Link to="/forgot-password" className="block text-center text-xs text-ink-muted hover:text-primary">
          Didn't get a code? Request a new one
        </Link>
      </form>
    </AuthLayout>
  )
}
