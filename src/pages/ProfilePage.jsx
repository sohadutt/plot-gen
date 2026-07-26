import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ArrowLeft, Camera, CheckCircle2, Compass, FolderOpen, Loader2, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { fetchFloorplans } from '../api/functions'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/Avatar'
import { AccountMenu } from '../components/layout/AccountMenu'

function initialsFor(user) {
  const name = user?.name || user?.email || ''
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?'
}

function tierLabel(tier) {
  if (tier === 2) return 'Premium'
  if (tier === 1) return 'Pro'
  return 'Free'
}

export default function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || '')
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ total: 0, publicCount: 0, latest: null })

  useEffect(() => {
    return () => {
      if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  useEffect(() => {
    let active = true
    fetchFloorplans({ sort: 'newest' })
      .then((plans) => {
        if (!active) return
        setStats({
          total: plans.length,
          publicCount: plans.filter((plan) => plan.isPublic).length,
          latest: plans[0] || null
        })
      })
      .catch(() => {
        if (active) toast.error('Could not load profile activity.')
      })
    return () => {
      active = false
    }
  }, [])

  const displayName = useMemo(() => {
    const full = `${firstName} ${lastName}`.trim()
    return full || user?.name || user?.username || 'Your profile'
  }, [firstName, lastName, user])

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file.')
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), avatarFile })
      setAvatarFile(null)
      toast.success('Profile updated.')
    } catch (error) {
      console.error('Failed to update profile:', error)
      toast.error('Could not update your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-screen w-full overflow-y-auto bg-blueprint-grid">
      <header className="border-b border-line bg-surface/85 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 rounded-md text-left text-ink">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Compass className="h-4.5 w-4.5" />
            </div>
            <span className="text-base font-semibold">Floor Planner</span>
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle variant="ghost" />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-5 sm:py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-5">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="mb-6 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <section className="rounded-lg border border-line bg-surface p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative w-fit">
                <Avatar className="h-24 w-24 border border-line">
                  {avatarPreview && <AvatarImage src={avatarPreview} alt={displayName} />}
                  <AvatarFallback className="text-2xl">{initialsFor({ name: displayName, email: user?.email })}</AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-sm transition-colors hover:bg-paper"
                  aria-label="Change profile photo"
                  title="Change profile photo"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold text-ink">{displayName}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    {user?.email}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {tierLabel(user?.tier)}
                  </span>
                  {user?.isVerified && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 text-xs text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-surface p-4 shadow-sm sm:gap-3">
            <div>
              <p className="text-xs font-medium text-ink-muted">Projects</p>
              <p className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{stats.total}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">Shared</p>
              <p className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{stats.publicCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted">Latest</p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">{stats.latest?.name || '-'}</p>
            </div>
          </section>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={handleSubmit} className="rounded-lg border border-line bg-surface p-4 shadow-sm sm:p-5">
            <div className="mb-5 flex items-center gap-2">
              <UserRound className="h-4 w-4 text-ink-muted" />
              <h2 className="text-base font-semibold text-ink">Profile details</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-muted">First name</span>
                <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-muted">Last name</span>
                <Input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-ink-muted">Email</span>
                <Input value={user?.email || ''} disabled />
              </label>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button type="button" variant="outline" onClick={() => navigate('/dashboard')} className="w-full sm:w-auto">
                Dashboard
              </Button>
              <Button type="submit" variant="primary" disabled={saving} className="w-full sm:w-auto">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
              </Button>
            </div>
          </form>

          <section className="rounded-lg border border-line bg-surface p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-ink-muted" />
              <h2 className="text-base font-semibold text-ink">Workspace</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-ink-muted">Username</span>
                <span className="max-w-[150px] truncate font-medium text-ink">{user?.username || '-'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-ink-muted">Account</span>
                <span className="font-medium text-ink">{tierLabel(user?.tier)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Visibility</span>
                <span className="font-medium text-ink">{stats.publicCount} shared</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
