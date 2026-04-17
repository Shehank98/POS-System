import { create } from 'zustand';
import { authApi } from '../api/client';
import { recordOnlineVerification, clearTampered } from '../utils/subscriptionGuard';

const stored = () => {
  try {
    return JSON.parse(localStorage.getItem('pos_user')) || null;
  } catch {
    return null;
  }
};

const useAuthStore = create((set) => ({
  user:    stored(),
  token:   localStorage.getItem('pos_token') || null,
  loading: false,
  error:   null,

  login: async (credentials) => {
    set({ loading: true, error: null });
    try {
      const { data } = await authApi.login(credentials);
      localStorage.setItem('pos_token', data.token);
      localStorage.setItem('pos_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, loading: false });
      // Record successful online verification and clear any tamper flag
      await Promise.all([recordOnlineVerification(), clearTampered()]);
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      set({ loading: false, error: msg });
      throw new Error(msg);
    }
  },

  logout: () => {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    set({ user: null, token: null });
  },

  refreshUser: async () => {
    try {
      const { data } = await authApi.me();
      localStorage.setItem('pos_user', JSON.stringify(data));
      set({ user: data });
      await recordOnlineVerification(); // successful server round-trip
    } catch {
      // silently ignore – interceptor handles 401
    }
  },
}));

export default useAuthStore;
