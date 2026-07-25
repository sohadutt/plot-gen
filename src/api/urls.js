/**
 * Every endpoint the app talks to, in one place.
 *
 * Wired to the real Django backend (plot-gen_backend) under /api/plotgen/.
 * Set VITE_API_BASE_URL in .env to point at it (e.g.
 * http://localhost:8000/api/plotgen during local dev). If it's unset AND
 * VITE_USE_MOCK_API=true, main.jsx falls back to the in-browser mock
 * (mockAdapter.js) instead — see that file's comment for details.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/plotgen'

export const ENDPOINTS = {
  // Furniture / doors / windows catalog (Django "Model")
  ITEMS: `${API_BASE_URL}/models/`,
  ITEM_BY_ID: (id) => `${API_BASE_URL}/models/${id}/`,

  // Floor & wall textures/materials
  TEXTURES: `${API_BASE_URL}/textures/`,
  TEXTURE_BY_ID: (id) => `${API_BASE_URL}/textures/${id}/`,

  // Starter room templates used by "New floorplan"
  TEMPLATES: `${API_BASE_URL}/templates/`,
  TEMPLATE_BY_ROOM_TYPE: (roomType) => `${API_BASE_URL}/templates/${roomType}/`,

  // Saved user projects (Django "Project")
  FLOORPLANS: `${API_BASE_URL}/projects/`,
  FLOORPLAN_BY_ID: (id) => `${API_BASE_URL}/projects/${id}/`,
  PUBLIC_FLOORPLAN: (shareToken) => `${API_BASE_URL}/public/projects/${shareToken}/`,

  // Binary uploads — each returns a hosted URL to store on the payload
  // (item.model / item.image / texture.url / floorplan.thumbnailUrl, etc).
  UPLOAD_MODEL: `${API_BASE_URL}/uploads/model/`,
  UPLOAD_TEXTURE: `${API_BASE_URL}/uploads/texture/`,
  UPLOAD_IMAGE: `${API_BASE_URL}/uploads/image/`,

  // AI room renders (Gemini) — a carousel of generated images per project,
  // optionally scoped to a specific room + angle.
  RENDERS: `${API_BASE_URL}/renders/`,
  RENDER_BY_ID: (id) => `${API_BASE_URL}/renders/${id}/`,

  // Authentication
  AUTH_SIGNUP: `${API_BASE_URL}/auth/register/`,
  AUTH_LOGIN: `${API_BASE_URL}/auth/login/`,
  AUTH_LOGOUT: `${API_BASE_URL}/auth/logout/`,
  AUTH_ME: `${API_BASE_URL}/auth/me/`,
  AUTH_GOOGLE: `${API_BASE_URL}/auth/google/`,
  AUTH_VERIFY: `${API_BASE_URL}/auth/verify/`,
  AUTH_TOKEN_REFRESH: `${API_BASE_URL}/auth/token/refresh/`,
  AUTH_FORGOT_PASSWORD: `${API_BASE_URL}/auth/password-reset/request/`,
  AUTH_RESET_PASSWORD: `${API_BASE_URL}/auth/password-reset/confirm/`
}
