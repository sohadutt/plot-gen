import axios from 'axios'
import { ENDPOINTS } from './urls'
import { getItemTypeForCategory } from '../lib/constants'

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

const ACCESS_TOKEN_KEY = 'plotgen_access_token'
const REFRESH_TOKEN_KEY = 'plotgen_refresh_token'

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem(ACCESS_TOKEN_KEY, access)
  if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// ---------------------------------------------------------------------------
// Axios instance — attaches the access token to every request, and silently
// refreshes + retries once on a 401 before giving up. Concurrent requests
// that 401 at the same time share a single in-flight refresh call instead of
// each firing their own.
// ---------------------------------------------------------------------------

export const apiClient = axios.create()

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise = null

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(ENDPOINTS.AUTH_TOKEN_REFRESH, { refresh: getRefreshToken() })
      .then((res) => {
        setTokens({ access: res.data.access, refresh: res.data.refresh })
        return res.data.access
      })
      .catch((err) => {
        clearTokens()
        throw err
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

// Requests to these endpoints should never trigger a refresh-and-retry —
// a 401 there means the credentials themselves were wrong, not that the
// access token expired.
const NO_REFRESH_URLS = [ENDPOINTS.AUTH_LOGIN, ENDPOINTS.AUTH_TOKEN_REFRESH, ENDPOINTS.AUTH_VERIFY]

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error
    if (!response || response.status !== 401 || !config || config._retried) {
      throw error
    }
    if (NO_REFRESH_URLS.some((url) => config.url?.startsWith(url))) {
      throw error
    }
    if (!getRefreshToken()) {
      throw error
    }

    config._retried = true
    const newAccess = await refreshAccessToken()
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${newAccess}`
    return apiClient(config)
  }
)

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Django REST's paginated list responses look like {count, next, previous,
 * results}. Non-paginated endpoints (templates) just return an array. */
function unwrapList(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.results)) return data.results
  return []
}

function pruneUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

// ---------------------------------------------------------------------------
// Adapters — translate between the frontend's field names (camelCase, the
// shape every component already expects) and the Django backend's field
// names (snake_case).
// ---------------------------------------------------------------------------

function toUser(u) {
  if (!u) return null
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.display_name || u.username,
    firstName: u.first_name || '',
    lastName: u.last_name || '',
    avatarUrl: u.profile_picture_url || null,
    tier: u.tier,
    isVerified: u.is_verified
  }
}

function toItem(m) {
  return {
    id: m.id,
    key: String(m.id),
    name: m.name,
    description: m.description || '',
    category: m.category,
    type: m.item_type != null ? String(m.item_type) : getItemTypeForCategory(m.category),
    image: m.thumbnail_url,
    model: m.file_url,
    boolean: m.is_boolean,
    isCustom: !m.is_public,
    viewerData: m.viewer_data && Object.keys(m.viewer_data).length ? m.viewer_data : undefined,
    createdAt: m.created_at ? new Date(m.created_at).getTime() : undefined
  }
}

function toItemPayload(item) {
  return pruneUndefined({
    name: item.name,
    description: item.description,
    category: item.category,
    file_url: item.model,
    thumbnail_url: item.image || undefined,
    is_boolean: item.boolean,
    item_type: item.type != null ? Number(item.type) : undefined,
    viewer_data: item.viewerData,
    is_public: false
  })
}

function toTexture(t) {
  return {
    id: t.id,
    name: t.name,
    type: t.texture_type,
    url: t.file_url,
    thumbnail: t.thumbnail_url || t.file_url,
    stretch: t.stretch,
    scale: t.scale,
    isColor: t.is_color,
    color: typeof t.rgb_color === 'string' ? t.rgb_color : t.rgb_color?.hex,
    glossy: t.glossy,
    isCustom: !t.is_public
  }
}

function toTexturePayload(payload) {
  const isColor = !!payload.isColor
  return pruneUndefined({
    name: payload.name,
    texture_type: payload.type,
    is_color: isColor,
    file_url: isColor ? undefined : payload.url,
    thumbnail_url: isColor ? undefined : payload.thumbnail || payload.url,
    rgb_color: isColor ? payload.color : undefined,
    stretch: isColor ? undefined : payload.stretch,
    scale: payload.scale,
    glossy: payload.glossy,
    is_public: false
  })
}

function toFloorplanSummary(p) {
  return {
    id: p.id,
    name: p.name,
    roomType: p.category,
    thumbnailUrl: p.thumbnail_url,
    isPublic: p.is_public,
    shareToken: p.share_token,
    createdAt: p.created_at ? new Date(p.created_at).getTime() : undefined,
    updatedAt: p.updated_at ? new Date(p.updated_at).getTime() : undefined
  }
}

function toFloorplanFull(p) {
  return {
    ...toFloorplanSummary(p),
    layoutData: p.scene_data || {}
  }
}

function toFloorplanPayload({ name, roomType, layoutData, thumbnailUrl, isPublic }) {
  return pruneUndefined({
    name,
    category: roomType,
    scene_data: layoutData,
    thumbnail_url: thumbnailUrl,
    is_public: isPublic
  })
}

function sortToOrdering(sort) {
  if (sort === 'oldest') return 'created_at'
  if (sort === 'name') return 'name'
  return '-created_at' // 'newest' and default
}

function toRender(r) {
  return {
    id: r.id,
    projectId: r.project,
    roomId: r.room_id || null,
    roomLabel: r.room_label || '',
    angle: r.angle,
    sourceImageUrl: r.source_image_url,
    sceneData: r.scene_data,
    prompt: r.prompt,
    resultImageUrl: r.result_image_url,
    status: r.status,
    errorMessage: r.error_message,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : undefined,
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : undefined
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Registers the account and sends an OTP to the given email. Login isn't
 * possible until verifyOtp() succeeds — returns {userId, email} so the
 * caller can route to the verification screen. */
export async function signup({ name, email, password }) {
  const res = await apiClient.post(ENDPOINTS.AUTH_SIGNUP, { name, email, password })
  return { userId: res.data.data.user_id, email: res.data.data.email }
}

/** Completes signup (or a fresh login-required re-verification): checks the
 * OTP, marks the account verified, and returns tokens + the user, same as
 * login() would. */
export async function verifyOtp({ email, otp }) {
  const res = await apiClient.post(ENDPOINTS.AUTH_VERIFY, { email, otp })
  setTokens(res.data.tokens)
  return toUser(res.data.data.user)
}

/** Resends a verification OTP to the given email. Always resolves — the
 * backend intentionally doesn't reveal whether the account exists. */
export async function resendOtp(email) {
  await apiClient.get(ENDPOINTS.AUTH_VERIFY, { params: { email } })
}

export async function login({ email, password }) {
  const res = await apiClient.post(ENDPOINTS.AUTH_LOGIN, { email, password })
  setTokens(res.data.data.tokens)
  return toUser(res.data.data.user)
}

export async function loginWithGoogle(credential) {
  const res = await apiClient.post(ENDPOINTS.AUTH_GOOGLE, { credential })
  setTokens(res.data.data.tokens)
  return toUser(res.data.data.user)
}

export async function logout() {
  const refresh = getRefreshToken()
  clearTokens()
  if (refresh) {
    try {
      await axios.post(ENDPOINTS.AUTH_LOGOUT, { refresh })
    } catch {
      // Already logged out client-side regardless of whether the blacklist
      // call succeeds — don't block the user on it.
    }
  }
}

export async function fetchCurrentUser() {
  const res = await apiClient.get(ENDPOINTS.AUTH_ME)
  return toUser(res.data)
}

export async function updateProfile(updates) {
  const res = await apiClient.patch(ENDPOINTS.AUTH_ME, pruneUndefined({
    first_name: updates.firstName,
    last_name: updates.lastName
  }))
  return toUser(res.data.data)
}

export async function requestPasswordReset(email) {
  await apiClient.post(ENDPOINTS.AUTH_FORGOT_PASSWORD, { email })
}

/** Verifies the OTP and sets the new password in one step, returning fresh
 * tokens so the caller can be signed straight in. */
export async function resetPassword({ email, otp, password }) {
  const res = await apiClient.post(ENDPOINTS.AUTH_RESET_PASSWORD, { email, otp, password })
  setTokens(res.data.tokens)
  return { userId: res.data.data.user_id, email: res.data.data.email }
}

// ---------------------------------------------------------------------------
// Items (furniture / doors / windows catalog)
// ---------------------------------------------------------------------------

export async function fetchItems({ category, search } = {}) {
  const res = await apiClient.get(ENDPOINTS.ITEMS, {
    params: pruneUndefined({ category, search, page_size: 100 })
  })
  return unwrapList(res.data).map(toItem)
}

export async function createItem(item) {
  const res = await apiClient.post(ENDPOINTS.ITEMS, toItemPayload(item))
  return toItem(res.data.data)
}

export async function deleteItem(id) {
  await apiClient.delete(ENDPOINTS.ITEM_BY_ID(id))
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

export async function fetchTextures(type) {
  const res = await apiClient.get(ENDPOINTS.TEXTURES, {
    params: pruneUndefined({ texture_type: type, page_size: 100 })
  })
  return unwrapList(res.data).map(toTexture)
}

export async function createTexture(payload) {
  const res = await apiClient.post(ENDPOINTS.TEXTURES, toTexturePayload(payload))
  return toTexture(res.data.data)
}

export async function deleteTexture(id) {
  await apiClient.delete(ENDPOINTS.TEXTURE_BY_ID(id))
}

// ---------------------------------------------------------------------------
// Starter templates
// ---------------------------------------------------------------------------

export async function fetchTemplates() {
  const res = await apiClient.get(ENDPOINTS.TEMPLATES)
  return res.data
}

export async function fetchTemplateByRoomType(roomType) {
  const res = await apiClient.get(ENDPOINTS.TEMPLATE_BY_ROOM_TYPE(roomType))
  return res.data
}

// ---------------------------------------------------------------------------
// Floorplans (saved projects)
// ---------------------------------------------------------------------------

export async function fetchFloorplans({ roomType, search, sort } = {}) {
  const res = await apiClient.get(ENDPOINTS.FLOORPLANS, {
    params: pruneUndefined({ category: roomType, search, ordering: sortToOrdering(sort), page_size: 100 })
  })
  return unwrapList(res.data).map(toFloorplanSummary)
}

export async function fetchFloorplanById(id) {
  const res = await apiClient.get(ENDPOINTS.FLOORPLAN_BY_ID(id))
  return toFloorplanFull(res.data)
}

export async function createFloorplan(payload) {
  const res = await apiClient.post(ENDPOINTS.FLOORPLANS, toFloorplanPayload(payload))
  return toFloorplanFull(res.data.data)
}

export async function updateFloorplan(id, payload) {
  const res = await apiClient.patch(ENDPOINTS.FLOORPLAN_BY_ID(id), toFloorplanPayload(payload))
  return toFloorplanFull(res.data.data)
}

export async function deleteFloorplan(id) {
  await apiClient.delete(ENDPOINTS.FLOORPLAN_BY_ID(id))
}

export async function fetchPublicFloorplan(shareToken) {
  const res = await axios.get(ENDPOINTS.PUBLIC_FLOORPLAN(shareToken))
  return toFloorplanFull(res.data)
}

// ---------------------------------------------------------------------------
// Uploads — each returns {url, name, size, mimeType}
// ---------------------------------------------------------------------------

async function uploadFile(endpoint, file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiClient.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
      ? (evt) => onProgress(evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0)
      : undefined
  })
  return res.data
}

export function uploadModelFile(file, onProgress) {
  return uploadFile(ENDPOINTS.UPLOAD_MODEL, file, onProgress)
}

export function uploadTextureImage(file, onProgress) {
  return uploadFile(ENDPOINTS.UPLOAD_TEXTURE, file, onProgress)
}

export function uploadImage(file, onProgress) {
  return uploadFile(ENDPOINTS.UPLOAD_IMAGE, file, onProgress)
}

/** Same as uploadImage, but takes a data: URL (e.g. from a canvas snapshot)
 * instead of a File — used for floorplan/room thumbnails. `endpoint` is
 * accepted for backward compatibility with existing call sites that pass
 * ENDPOINTS.UPLOAD_IMAGE explicitly; it's always used regardless. */
export async function uploadDataUrl(endpoint, dataUrl, filename = 'image.webp') {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const file = new File([blob], filename, { type: blob.type || 'image/webp' })
  return uploadFile(endpoint || ENDPOINTS.UPLOAD_IMAGE, file)
}

// ---------------------------------------------------------------------------
// AI room renders (Gemini carousel)
// ---------------------------------------------------------------------------

/** List renders for a project, optionally scoped to one room and/or angle. */
export async function fetchRenders({ projectId, roomId, angle } = {}) {
  const res = await apiClient.get(ENDPOINTS.RENDERS, {
    params: pruneUndefined({ project: projectId, room_id: roomId, angle, page_size: 50 })
  })
  return unwrapList(res.data).map(toRender)
}

/** Requests a new AI render. Always creates a new carousel entry — call
 * regenerateRender() instead to replace an existing one in place. */
export async function createRender({ projectId, roomId, roomLabel, angle, sourceImageUrl, sceneData, prompt }) {
  const res = await apiClient.post(ENDPOINTS.RENDERS, pruneUndefined({
    project: projectId,
    room_id: roomId,
    room_label: roomLabel,
    angle,
    source_image_url: sourceImageUrl,
    scene_data: sceneData,
    prompt
  }))
  return toRender(res.data.data)
}

/** Replaces an existing render's image in place (same carousel slot) rather
 * than creating a new entry. Optionally updates the source image/prompt
 * first. */
export async function regenerateRender(id, updates = {}) {
  const res = await apiClient.post(ENDPOINTS.RENDER_BY_ID(id), pruneUndefined({
    source_image_url: updates.sourceImageUrl,
    scene_data: updates.sceneData,
    prompt: updates.prompt,
    room_id: updates.roomId,
    room_label: updates.roomLabel,
    angle: updates.angle
  }))
  return toRender(res.data.data)
}

export async function fetchRenderById(id) {
  const res = await apiClient.get(ENDPOINTS.RENDER_BY_ID(id))
  return toRender(res.data)
}

export async function deleteRender(id) {
  await apiClient.delete(ENDPOINTS.RENDER_BY_ID(id))
}

export async function loginWithGoogle(credential) {
    const data = await postRequest(ENDPOINTS.GOOGLE_LOGIN, { credential });
    return persistAuthSession(data);
}