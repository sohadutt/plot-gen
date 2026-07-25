/**
 * ---------------------------------------------------------------------
 * MOCK BACKEND
 * ---------------------------------------------------------------------
 * This file stands in for a real server while there isn't one yet. It
 * attaches to the shared `apiClient` axios instance and intercepts every
 * request made to the URLs declared in `urls.js`, answering them out of
 * localStorage (acting like a tiny database) instead of hitting the
 * network.
 *
 * Nothing else in the app talks to localStorage directly — components
 * only ever call the functions in `functions.js`. That means switching
 * to a real backend later is a two-step change:
 *   1. Point API_BASE_URL (urls.js) at the real server.
 *   2. Delete the `import './api/mockAdapter'` line in `main.jsx`.
 *
 * Everything else (components, uploads, item browser, texture picker,
 * saved projects) keeps working unmodified.
 * ---------------------------------------------------------------------
 */
import MockAdapter from 'axios-mock-adapter'
import { apiClient } from './functions'
import { ENDPOINTS } from './urls'
import { ITEMS as SEED_ITEMS, FLOOR_TEXTURES as SEED_FLOOR_TEXTURES, WALL_TEXTURES as SEED_WALL_TEXTURES } from '@blueprint3d/constants'
import DefaultTemplate from '@blueprint3d/templates/default.json'
import { ROOM_TYPES } from '../lib/constants'

const DB_KEYS = {
  items: 'mockdb:items',
  textures: 'mockdb:textures',
  floorplans: 'mockdb:floorplans',
  users: 'mockdb:users',
  sessions: 'mockdb:sessions',
  seedVersion: 'mockdb:seed-version'
}

// Bump this if the seed data below changes shape, to force a re-seed.
const SEED_VERSION = 'v2'

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function readTable(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeTable(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows))
}

function idFromUrl(url) {
  return decodeURIComponent(url.split('/').filter(Boolean).pop())
}

function seedIfNeeded() {
  if (localStorage.getItem(DB_KEYS.seedVersion) === SEED_VERSION) return

  const now = Date.now()

  const items = SEED_ITEMS.map((item) => ({
    id: uid(),
    isCustom: false,
    createdAt: now,
    ...item
  }))

  const textures = [
    ...SEED_FLOOR_TEXTURES.map((t) => ({ id: uid(), type: 'floor', isCustom: false, createdAt: now, ...t })),
    ...SEED_WALL_TEXTURES.map((t) => ({ id: uid(), type: 'wall', isCustom: false, createdAt: now, ...t }))
  ]

  writeTable(DB_KEYS.items, items)
  writeTable(DB_KEYS.textures, textures)
  if (!localStorage.getItem(DB_KEYS.floorplans)) writeTable(DB_KEYS.floorplans, [])
  localStorage.setItem(DB_KEYS.seedVersion, SEED_VERSION)
}

seedIfNeeded()

const mock = new MockAdapter(apiClient, { delayResponse: 300 })

/* ------------------------------------------------------------------ *
 * Items
 * ------------------------------------------------------------------ */

mock.onGet(ENDPOINTS.ITEMS).reply((config) => {
  const { category, search } = config.params || {}
  let rows = readTable(DB_KEYS.items)
  if (category && category !== 'all') rows = rows.filter((r) => r.category === category)
  if (search) {
    const q = String(search).toLowerCase()
    rows = rows.filter((r) => r.name.toLowerCase().includes(q))
  }
  return [200, rows]
})

mock.onPost(ENDPOINTS.ITEMS).reply((config) => {
  const payload = JSON.parse(config.data)
  const rows = readTable(DB_KEYS.items)
  const record = { id: uid(), isCustom: true, createdAt: Date.now(), ...payload }
  rows.unshift(record)
  writeTable(DB_KEYS.items, rows)
  return [201, record]
})

mock.onDelete(new RegExp(`^${ENDPOINTS.ITEMS}/`)).reply((config) => {
  const id = idFromUrl(config.url)
  writeTable(DB_KEYS.items, readTable(DB_KEYS.items).filter((r) => r.id !== id))
  return [204]
})

/* ------------------------------------------------------------------ *
 * Textures
 * ------------------------------------------------------------------ */

mock.onGet(ENDPOINTS.TEXTURES).reply((config) => {
  const { type } = config.params || {}
  let rows = readTable(DB_KEYS.textures)
  if (type) rows = rows.filter((r) => r.type === type)
  return [200, rows]
})

mock.onPost(ENDPOINTS.TEXTURES).reply((config) => {
  const payload = JSON.parse(config.data)
  const rows = readTable(DB_KEYS.textures)
  const record = { id: uid(), isCustom: true, createdAt: Date.now(), ...payload }
  rows.unshift(record)
  writeTable(DB_KEYS.textures, rows)
  return [201, record]
})

mock.onDelete(new RegExp(`^${ENDPOINTS.TEXTURES}/`)).reply((config) => {
  const id = idFromUrl(config.url)
  writeTable(DB_KEYS.textures, readTable(DB_KEYS.textures).filter((r) => r.id !== id))
  return [204]
})

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

mock.onGet(ENDPOINTS.TEMPLATES).reply(() => {
  const templates = ROOM_TYPES.map((rt) => ({
    roomType: rt.value,
    name: rt.label,
    layoutData: clone(DefaultTemplate)
  }))
  return [200, templates]
})

mock.onGet(new RegExp(`^${ENDPOINTS.TEMPLATES}/`)).reply((config) => {
  const roomType = idFromUrl(config.url)
  return [200, { roomType, layoutData: clone(DefaultTemplate) }]
})

/* ------------------------------------------------------------------ *
 * Saved floorplans
 * ------------------------------------------------------------------ */

mock.onGet(ENDPOINTS.FLOORPLANS).reply((config) => {
  const { roomType, search, sort = 'newest' } = config.params || {}
  let rows = readTable(DB_KEYS.floorplans)

  if (roomType && roomType !== 'all') rows = rows.filter((r) => r.roomType === roomType)
  if (search) {
    const q = String(search).toLowerCase()
    rows = rows.filter((r) => r.name.toLowerCase().includes(q))
  }

  rows = [...rows].sort((a, b) => {
    if (sort === 'oldest') return a.updatedAt - b.updatedAt
    if (sort === 'name') return a.name.localeCompare(b.name)
    return b.updatedAt - a.updatedAt
  })

  // List view omits the heavy layoutData payload, same shape a real API would return.
  return [200, rows.map(({ layoutData, ...summary }) => summary)]
})

mock.onPost(ENDPOINTS.FLOORPLANS).reply((config) => {
  const payload = JSON.parse(config.data)
  const rows = readTable(DB_KEYS.floorplans)
  const now = Date.now()
  const record = {
    id: uid(),
    name: payload.name,
    roomType: payload.roomType || 'bedroom',
    thumbnailUrl: payload.thumbnailUrl || null,
    layoutData: payload.layoutData,
    createdAt: now,
    updatedAt: now
  }
  rows.unshift(record)
  writeTable(DB_KEYS.floorplans, rows)
  return [201, record]
})

mock.onGet(new RegExp(`^${ENDPOINTS.FLOORPLANS}/`)).reply((config) => {
  const id = idFromUrl(config.url)
  const record = readTable(DB_KEYS.floorplans).find((r) => r.id === id)
  return record ? [200, record] : [404, { message: 'Floorplan not found' }]
})

mock.onPut(new RegExp(`^${ENDPOINTS.FLOORPLANS}/`)).reply((config) => {
  const id = idFromUrl(config.url)
  const payload = JSON.parse(config.data)
  const rows = readTable(DB_KEYS.floorplans)
  const index = rows.findIndex((r) => r.id === id)
  if (index === -1) return [404, { message: 'Floorplan not found' }]

  rows[index] = { ...rows[index], ...payload, id, updatedAt: Date.now() }
  writeTable(DB_KEYS.floorplans, rows)
  return [200, rows[index]]
})

mock.onDelete(new RegExp(`^${ENDPOINTS.FLOORPLANS}/`)).reply((config) => {
  const id = idFromUrl(config.url)
  writeTable(DB_KEYS.floorplans, readTable(DB_KEYS.floorplans).filter((r) => r.id !== id))
  return [204]
})

/* ------------------------------------------------------------------ *
 * Uploads (glb models, texture images, thumbnails)
 *
 * A real backend would store the file (S3, GCS, etc.) and return its
 * public URL. This mock instead inlines the file as a base64 data: URL,
 * so uploaded content still renders immediately without a real server.
 * ------------------------------------------------------------------ */

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function handleUpload(config) {
  const file = config.data instanceof FormData ? config.data.get('file') : null
  if (!file) return Promise.resolve([400, { message: 'No file provided under the "file" field.' }])

  return fileToDataUrl(file).then((url) => [
    201,
    {
      url, // a real backend would return a hosted/CDN URL here instead
      name: file.name,
      size: file.size,
      mimeType: file.type
    }
  ])
}

mock.onPost(ENDPOINTS.UPLOAD_MODEL).reply(handleUpload)
mock.onPost(ENDPOINTS.UPLOAD_TEXTURE).reply(handleUpload)
mock.onPost(ENDPOINTS.UPLOAD_IMAGE).reply(handleUpload)

/* ------------------------------------------------------------------ *
 * Authentication
 *
 * A deliberately simple mock: users and sessions are just rows in
 * localStorage, and a "token" is a random string mapped to a user id.
 * Passwords are stored as plain text here ONLY because this is a
 * throwaway mock with no real data behind it — a real backend must
 * hash passwords (bcrypt/argon2, etc.) and never do this.
 * ------------------------------------------------------------------ */

function publicUser(user) {
  if (!user) return null
  const { password, ...rest } = user
  return rest
}

function findUserByEmail(email) {
  return readTable(DB_KEYS.users).find((u) => u.email.toLowerCase() === String(email).toLowerCase())
}

function createSession(userId) {
  const token = uid()
  const sessions = readTable(DB_KEYS.sessions)
  sessions.push({ token, userId, createdAt: Date.now() })
  writeTable(DB_KEYS.sessions, sessions)
  return token
}

function userFromRequest(config) {
  const authHeader = config.headers?.Authorization || config.headers?.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  const session = readTable(DB_KEYS.sessions).find((s) => s.token === token)
  if (!session) return null
  return readTable(DB_KEYS.users).find((u) => u.id === session.userId) || null
}

mock.onPost(ENDPOINTS.AUTH_SIGNUP).reply((config) => {
  const { name, email, password } = JSON.parse(config.data)
  if (!name || !email || !password) return [400, { message: 'Name, email, and password are all required.' }]
  if (findUserByEmail(email)) return [409, { message: 'An account with that email already exists.' }]

  const now = Date.now()
  const user = { id: uid(), name, email, password, provider: 'password', createdAt: now }
  const users = readTable(DB_KEYS.users)
  users.push(user)
  writeTable(DB_KEYS.users, users)

  const token = createSession(user.id)
  return [201, { user: publicUser(user), token }]
})

mock.onPost(ENDPOINTS.AUTH_LOGIN).reply((config) => {
  const { email, password } = JSON.parse(config.data)
  const user = findUserByEmail(email || '')
  if (!user || user.password !== password) {
    return [401, { message: 'Incorrect email or password.' }]
  }
  const token = createSession(user.id)
  return [200, { user: publicUser(user), token }]
})

mock.onPost(ENDPOINTS.AUTH_LOGOUT).reply((config) => {
  const authHeader = config.headers?.Authorization || config.headers?.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (token) {
    writeTable(DB_KEYS.sessions, readTable(DB_KEYS.sessions).filter((s) => s.token !== token))
  }
  return [204]
})

mock.onGet(ENDPOINTS.AUTH_ME).reply((config) => {
  const user = userFromRequest(config)
  return user ? [200, publicUser(user)] : [401, { message: 'Not signed in.' }]
})

// Mock-only "Google sign-in": creates/reuses one demo Google-linked account so
// the rest of the app (dashboard, protected routes) works end-to-end. Swap
// this handler out — and the loginWithGoogle() call site in AuthContext —
// for a real OAuth flow once a backend exists.
mock.onPost(ENDPOINTS.AUTH_GOOGLE).reply(() => {
  let user = readTable(DB_KEYS.users).find((u) => u.provider === 'google')
  if (!user) {
    user = {
      id: uid(),
      name: 'Google User',
      email: 'demo.google.user@example.com',
      provider: 'google',
      createdAt: Date.now()
    }
    const users = readTable(DB_KEYS.users)
    users.push(user)
    writeTable(DB_KEYS.users, users)
  }
  const token = createSession(user.id)
  return [200, { user: publicUser(user), token }]
})

mock.onPost(ENDPOINTS.AUTH_FORGOT_PASSWORD).reply((config) => {
  const { email } = JSON.parse(config.data)
  const user = findUserByEmail(email || '')
  if (user) {
    const token = uid()
    const users = readTable(DB_KEYS.users).map((u) => (u.id === user.id ? { ...u, resetToken: token, resetTokenExpires: Date.now() + 30 * 60 * 1000 } : u))
    writeTable(DB_KEYS.users, users)
    // A real backend emails this link; the mock just logs it so you can test the flow locally.
    console.info(`[mock] Password reset link for ${email}: /reset-password?token=${token}`)
  }
  // Always 200, whether or not the email matched a user — don't leak which emails have accounts.
  return [200, { message: 'If that email has an account, a reset link has been sent.' }]
})

mock.onPost(ENDPOINTS.AUTH_RESET_PASSWORD).reply((config) => {
  const { token, password } = JSON.parse(config.data)
  const users = readTable(DB_KEYS.users)
  const user = users.find((u) => u.resetToken === token && u.resetTokenExpires > Date.now())
  if (!user) return [400, { message: 'That reset link is invalid or has expired.' }]

  const updated = users.map((u) =>
    u.id === user.id ? { ...u, password, resetToken: undefined, resetTokenExpires: undefined } : u
  )
  writeTable(DB_KEYS.users, updated)
  return [200, { message: 'Password updated.' }]
})

// Anything not explicitly handled above passes through as normal (useful
// once a real backend exists alongside a couple of remaining mocks).
mock.onAny().passThrough()

export default mock
