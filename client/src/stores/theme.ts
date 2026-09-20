import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  /** Resolved theme currently applied to <html> */
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
  cycle: () => void;
}

const mq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);
const resolve = (mode: ThemeMode) => (mode === 'system' ? !!mq()?.matches : mode === 'dark');

function apply(dark: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1220' : '#15803d');
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      isDark: false,
      setMode: (mode) => {
        const isDark = resolve(mode);
        apply(isDark);
        set({ mode, isDark });
      },
      cycle: () => {
        const order: ThemeMode[] = ['light', 'dark', 'system'];
        get().setMode(order[(order.indexOf(get().mode) + 1) % order.length]);
      },
    }),
    {
      name: 'qareeb.theme',
      partialize: (s) => ({ mode: s.mode }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setMode(state.mode);
      },
    },
  ),
);

/** Mount once at the app root: applies the theme and tracks OS changes while in "system" mode. */
export function useThemeSync() {
  const mode = useTheme((s) => s.mode);
  useEffect(() => {
    useTheme.getState().setMode(mode);
    const m = mq();
    if (!m || mode !== 'system') return;
    const onChange = () => useTheme.getState().setMode('system');
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [mode]);
}
