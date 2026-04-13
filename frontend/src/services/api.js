import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
})

// Clerk token injected at request time — avoids stale token issues.
// The caller must pass a getToken function via config when needed,
// or we rely on the global setter below for convenience.
let _getToken = null

export function setTokenGetter(fn) {
  _getToken = fn
}

api.interceptors.request.use(async (config) => {
  if (_getToken) {
    try {
      const token = await _getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // unauthenticated request — let it through
    }
  }
  return config
})

export default api
