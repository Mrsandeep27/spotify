export const API_BASE_URL = 'https://spofity-backend.onrender.com';

export const SOCKET_URL = API_BASE_URL;

export const ENDPOINTS = {
  // Auth (all on Railway backend)
  register: `${API_BASE_URL}/api/auth/register`,
  login: `${API_BASE_URL}/api/auth/login`,
  googleAuth: `${API_BASE_URL}/api/auth/google`,
  me: `${API_BASE_URL}/api/auth/me`,

  // Songs
  search: (q) => `${API_BASE_URL}/api/songs/search?q=${encodeURIComponent(q)}`,
  stream: (videoId) => `${API_BASE_URL}/api/songs/stream/${videoId}`,
  streamUrl: (videoId) => `${API_BASE_URL}/api/songs/stream-url/${videoId}`,
  info: (videoId) => `${API_BASE_URL}/api/songs/info/${videoId}`,
  featured: `${API_BASE_URL}/api/songs/featured`,

  // Group session
  createSession: `${API_BASE_URL}/api/session/create`,
  getSession: (code) => `${API_BASE_URL}/api/session/${code}`,
};
