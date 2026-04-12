import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAdminStore = create(
  persist(
    (set) => ({
      token: null,

      login: (token) => {
        localStorage.setItem('pos_admin_token', token);
        set({ token });
      },

      logout: () => {
        localStorage.removeItem('pos_admin_token');
        set({ token: null });
      },

      isAuthenticated: () => {
        const state = useAdminStore.getState();
        return !!state.token;
      },
    }),
    {
      name: 'pos_admin_auth',
      partialize: (s) => ({ token: s.token }),
    }
  )
);

export default useAdminStore;
