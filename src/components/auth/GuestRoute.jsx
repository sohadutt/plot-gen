import { Navigate } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'

/** Wraps login/signup/forgot-password so an already-signed-in user skips straight past them. */
export function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return null
  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return children
}
