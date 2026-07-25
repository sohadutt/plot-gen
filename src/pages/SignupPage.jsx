import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useGoogleLogin } from '@react-oauth/google'
import { AuthLayout } from '../components/auth/AuthLayout'
import { GoogleButton } from '../components/auth/GoogleButton'
import { PasswordInput } from '../components/auth/PasswordInput'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'

export default function SignupPage() {
  const { signup, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

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
      const confirmedEmail = await signup(name.trim(), email.trim(), password)
      toast.success('Account created — check your email for a verification code.')
      navigate('/verify-email', { replace: true, state: { email: confirmedEmail } })
    } catch (error) {
      const message = error?.response?.data?.message || 'Could not create your account.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        await loginWithGoogle(tokenResponse.access_token);
        toast.success("Account verified via Google Cloud.");
        navigate('/', { replace: true }); // <-- Fixed undefined 'redirectTo'
      } catch (error) {
         console.error("Google Signup Error:", error);
         toast.error("Cloud verification failed. Please retry.");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error("Verification sequence aborted.");
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      description="Design floor plans, save them, and pick up anywhere."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <GoogleButton label="Sign up with Google" onClick={handleGoogle} loading={googleLoading} />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs text-ink-muted">or</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Full name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Rivera" required autoFocus />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Password</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Confirm password</label>
            <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
          </div>

          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-xs text-ink-muted">
          By continuing you agree to the (placeholder) Terms of Service and Privacy Policy.
        </p>
      </div>
    </AuthLayout>
  )
}