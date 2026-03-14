import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { API_BASE_URL } from '../config/api';

const TOKEN_KEY = 'spofity_token';
let _authListeners = [];

// Fetch with timeout + retry for Render cold-start delays
async function fetchWithRetry(url, options = {}, timeoutMs = 30000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      const isLast = attempt === retries;
      if (isLast) {
        if (err.name === 'AbortError') {
          throw new Error('Server is taking too long to respond. It may be starting up — please try again in a moment.');
        }
        throw new Error('Cannot connect to server. Please check your internet connection and try again.');
      }
      // Wait 3s before retry
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function _notify(user) {
  _authListeners.forEach((cb) => cb(user));
}

async function getDeviceInfo() {
  try {
    const deviceId =
      Platform.OS === 'android'
        ? Application.androidId
        : await Application.getIosIdForVendorAsync?.() || 'unknown';
    return {
      deviceId: deviceId || 'unknown',
      deviceName: Application.applicationName || 'Spofity App',
      os: `${Platform.OS} ${Platform.Version}`,
      appVersion: Application.nativeApplicationVersion || '1.0',
    };
  } catch {
    return {};
  }
}

export const AuthService = {
  // Monitor auth state changes (called once on app start)
  onAuthStateChange(callback) {
    _authListeners.push(callback);

    // Check stored token immediately
    AsyncStorage.getItem(TOKEN_KEY).then((token) => {
      if (token) {
        try {
          const decoded = jwtDecode(token);
          const expired = decoded.exp && decoded.exp * 1000 < Date.now();
          callback(expired ? null : decoded);
        } catch {
          callback(null);
        }
      } else {
        callback(null);
      }
    });

    return () => {
      _authListeners = _authListeners.filter((cb) => cb !== callback);
    };
  },

  // Get token for API calls
  async getToken() {
    return AsyncStorage.getItem(TOKEN_KEY);
  },

  // Current user from stored token
  async getCurrentUser() {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp && decoded.exp * 1000 < Date.now()) return null;
      return decoded;
    } catch { return null; }
  },

  // Email register
  async signUpWithEmail(email, password, displayName) {
    const device = await getDeviceInfo();
    const res = await fetchWithRetry(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, ...device }),
    });
    const data = await res.json();
    if (data.error === 'pending_approval') {
      const err = new Error(data.message || 'Pending approval');
      err.code = 'pending_approval';
      err.email = email;
      throw err;
    }
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    _notify(jwtDecode(data.token));
    return data.user;
  },

  // Email login
  async signInWithEmail(email, password) {
    const device = await getDeviceInfo();
    const res = await fetchWithRetry(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...device }),
    });
    const data = await res.json();
    if (data.error === 'pending_approval') {
      const err = new Error(data.message || 'Pending approval');
      err.code = 'pending_approval';
      err.email = email;
      throw err;
    }
    if (!res.ok) throw new Error(data.error || 'Login failed');
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    _notify(jwtDecode(data.token));
    return data.user;
  },

  // Google sign in — pass idToken from expo-auth-session
  async signInWithGoogle(idToken) {
    const device = await getDeviceInfo();
    const res = await fetchWithRetry(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, ...device }),
    });
    const data = await res.json();
    if (data.error === 'pending_approval') {
      const err = new Error(data.message || 'Pending approval');
      err.code = 'pending_approval';
      err.email = null;
      throw err;
    }
    if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    _notify(jwtDecode(data.token));
    return data.user;
  },

  // Sign out
  async signOut() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    _notify(null);
  },
};
