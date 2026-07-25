import { cn } from '../../lib/utils'

// NOTE: this renders a custom-styled button, but doesn't itself obtain a
// Google ID token — the backend's /auth/google/ endpoint needs a real one
// (it verifies it server-side via google.oauth2.id_token). To wire this up:
//   1. Load https://accounts.google.com/gsi/client
//   2. google.accounts.id.initialize({ client_id: VITE_GOOGLE_CLIENT_ID, callback })
//   3. Render Google's own button into a same-size container positioned
//      under this one (or use google.accounts.id.prompt() for One Tap) so
//      the click actually goes through Google's flow and `callback` gets
//      { credential } — pass that into loginWithGoogle(credential).
// Until then, onClick calling loginWithGoogle() with no token correctly
// gets rejected by the backend, and callers show a "not configured" toast.

/** Official Google "G" mark, inline so no external asset/network request is needed. */
function GoogleMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.91c1.7-1.57 2.69-3.88 2.69-6.64z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.27c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71c-.18-.54-.28-1.11-.28-1.71s.1-1.17.28-1.71V4.96H.96A8.996 8.996 0 000 9c0 1.45.35 2.83.96 4.04l3-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  )
}

export function GoogleButton({ label = 'Continue with Google', onClick, loading, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        'inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface text-sm font-medium text-ink',
        'transition-colors hover:bg-paper disabled:opacity-50 disabled:pointer-events-none',
        className
      )}
    >
      <GoogleMark className="h-4 w-4" />
      {loading ? 'Connecting…' : label}
    </button>
  )
}
