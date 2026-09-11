import axios from 'axios';

const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const api = axios.create({
  baseURL: API_ORIGIN,
});

// Pick the correct token for every request.
// Admin APIs use adminToken; normal APIs use token.
api.interceptors.request.use((config) => {
  const url = config.url || '';
  const isAdminPath = url.startsWith('/api/admin');

  const token = localStorage.getItem(
    isAdminPath ? 'adminToken' : 'token'
  );

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers) {
    delete config.headers.Authorization;
  }

  return config;
});

export const UPLOADS_BASE = (
  import.meta.env.VITE_UPLOADS_URL ||
  `${API_ORIGIN}/uploads`
).replace(/\/+$/, '');

export function uploadUrl(imageUrl) {
  if (!imageUrl) return null;

  // Future-proof this if object storage is added later.
  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  const cleanPath = String(imageUrl).split('?')[0];
  const filename = cleanPath.split('/').pop();

  if (!filename) return null;

  return `${UPLOADS_BASE}/${filename}`;
}