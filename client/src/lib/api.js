import { storage } from './storage.js';

// Empty in the browser (same origin / Vite proxy). Set VITE_API_URL when the
// client is bundled into a native app, e.g. https://api.trailing.app
export const API_BASE = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'trailing.token';

export const getToken = () => storage.get(TOKEN_KEY);
export const setToken = (t) => (t ? storage.set(TOKEN_KEY, t) : storage.remove(TOKEN_KEY));

/** Resolve server-relative media URLs (e.g. /uploads/x.jpg) against the API host. */
export const assetUrl = (url) => (!url ? url : /^https?:/.test(url) ? url : API_BASE + url);

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  const res = await fetch(`${API_BASE}/api${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    if (res.status === 401 && token) window.dispatchEvent(new Event('trailing:logout'));
    throw err;
  }
  return data;
}
