import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RunnerProfile, User } from '@/lib/types';

interface AuthState {
  token: string | null;
  user: User | null;
  shop: { id: string; name: string; status: string } | null;
  runnerProfile: RunnerProfile | null;
  hydrated: boolean;
  setSession: (token: string, user: User) => void;
  setUser: (user: User) => void;
  setExtras: (extras: { shop?: AuthState['shop']; runnerProfile?: RunnerProfile | null }) => void;
  logout: () => void;
  setHydrated: (v: boolean) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      shop: null,
      runnerProfile: null,
      hydrated: false,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      setExtras: (extras) => set((s) => ({ shop: extras.shop === undefined ? s.shop : extras.shop, runnerProfile: extras.runnerProfile === undefined ? s.runnerProfile : extras.runnerProfile })),
      logout: () => set({ token: null, user: null, shop: null, runnerProfile: null }),
      setHydrated: (v) => set({ hydrated: v }),
    }),
    { name: 'qareeb.auth', partialize: (s) => ({ token: s.token, user: s.user, shop: s.shop, runnerProfile: s.runnerProfile }) },
  ),
);

export const homeForRole = (role?: string | null) => (role === 'MERCHANT' ? '/merchant' : role === 'RUNNER' ? '/runner' : role === 'ADMIN' ? '/admin' : '/home');
