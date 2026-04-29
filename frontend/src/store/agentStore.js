import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAgentStore = create(
  persist(
    (set) => ({
      token: null,
      agent: null,

      login: (token, agent) => {
        localStorage.setItem('pos_agent_token', token);
        set({ token, agent });
      },

      logout: () => {
        localStorage.removeItem('pos_agent_token');
        set({ token: null, agent: null });
      },
    }),
    {
      name: 'pos_agent_auth',
      partialize: (s) => ({ token: s.token, agent: s.agent }),
    }
  )
);

export default useAgentStore;
