import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { toast } from 'sonner'
import { AuthLayout } from '../components/auth/AuthLayout'
import { GoogleButton } from '../components/auth/GoogleButton'
import { PasswordInput } from '../components/auth/PasswordInput'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/AuthContext'
import { useGoogleLogin } from '@react-oauth/google'

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const user = await login(email.trim(), password)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}.`)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      if (error?.response?.status === 403) {
        toast.error('Please verify your email first — we sent you a code.')
        navigate('/verify-email', { state: { email: email.trim() } })
        return
      }
      const message = error?.response?.data?.message || 'Incorrect email or password.'
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
        toast.success("Cloud identity verified.");
        navigate(redirectTo, { replace: true });
      } catch (error) {
         console.error("Google Login Error:", error);
         toast.error("Google authentication failed.");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error("Google Sign-In sequence aborted.");
    }
  });

  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back — pick up where you left off."
      footer={
        <>
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <GoogleButton onClick={handleGoogle} loading={googleLoading} />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs text-ink-muted">or</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-medium text-ink-muted">Password</label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>

          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}