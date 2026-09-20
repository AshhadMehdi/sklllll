import { Moon, Sun, SunMoon } from 'lucide-react';
import { useTheme, type ThemeMode } from '@/stores/theme';
import { cn } from '@/lib/utils';

const META: Record<ThemeMode, { label: string; Icon: typeof Sun }> = {
  light: { label: 'Light', Icon: Sun },
  dark: { label: 'Dark', Icon: Moon },
  system: { label: 'System', Icon: SunMoon },
};

/** Icon button that cycles light → dark → system. */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, cycle } = useTheme();
  const { label, Icon } = META[mode];
  return (
    <button type="button" onClick={cycle} title={`Theme: ${label} (tap to change)`} aria-label={`Theme: ${label}`} className={cn('grid h-10 w-10 place-items-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-100 hover:bg-slate-50', className)}>
      <Icon className="h-4.5 w-4.5" />
    </button>
  );
}

/** Segmented control for settings screens. */
export function ThemeSegment({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();
  return (
    <div className={cn('flex rounded-xl bg-slate-100 p-1', className)}>
      {(Object.keys(META) as ThemeMode[]).map((m) => {
        const { label, Icon } = META[m];
        const active = m === mode;
        return (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition', active ? 'bg-white text-ink shadow-sm' : 'text-slate-500')}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        );
      })}
    </div>
  );
}
