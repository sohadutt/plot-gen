import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import * as authApi from '../api/functions'
import { getAccessToken, clearTokens } from '../api/functions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Set right after signup() so the UI can route to the "enter your code"
  // screen — cleared once verifyOtp() succeeds (or the flow is abandoned).
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(null)

  // On first load, if a token is already stored, check whether it's still
  // valid and fetch the signed-in user — this is what keeps you logged in
  // across reloads. A stale/expired token just falls back to logged-out
  // rather than throwing, since apiClient will attempt a silent refresh
  // first anyway.
  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false)
      return
    }
    authApi
      .fetchCurrentUser()
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const nextUser = await authApi.login({ email, password })
    setUser(nextUser)
    return nextUser
  }, [])

  /** Registers the account and sends an OTP — does NOT sign the user in.
   * The caller should route to a verification screen using the returned
   * email once this resolves. */
  const signup = useCallback(async (name, email, password) => {
    const { email: confirmedEmail } = await authApi.signup({ name, email, password })
    setPendingVerificationEmail(confirmedEmail)
    return confirmedEmail
  }, [])

  const verifyOtp = useCallback(async (email, otp) => {
    const nextUser = await authApi.verifyOtp({ email, otp })
    setUser(nextUser)
    setPendingVerificationEmail(null)
    return nextUser
  }, [])

  const resendOtp = useCallback(async (email) => authApi.resendOtp(email), [])

  const loginWithGoogle = useCallback(async (credential) => {
    const nextUser = await authApi.loginWithGoogle(credential)
    setUser(nextUser)
    return nextUser
  }, [])

  const forgotPassword = useCallback((email) => authApi.requestPasswordReset(email), [])

  /** Verifies the OTP, sets the new password, and signs the user in. */
  const resetPassword = useCallback(async (email, otp, password) => {
    await authApi.resetPassword({ email, otp, password })
    const nextUser = await authApi.fetchCurrentUser()
    setUser(nextUser)
    return nextUser
  }, [])

  const updateProfile = useCallback(async (updates) => {
    const nextUser = await authApi.updateProfile(updates)
    setUser(nextUser)
    return nextUser
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Even if the blacklist request fails (e.g. offline), still clear
      // the local session — tokens are already wiped by authApi.logout().
    }
    setUser(null)
  }, [])

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    pendingVerificationEmail,
    setPendingVerificationEmail,
    login,
    signup,
    verifyOtp,
    resendOtp,
    logout,
    loginWithGoogle,
    forgotPassword,
    resetPassword,
    updateProfile
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>')
  return ctx
}
