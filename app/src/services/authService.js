import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { API_BASE_URL } from '../config/api';

const TOKEN_KEY = 'spofity_token';
let _authListeners = [];

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
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
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
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
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
    const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
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
