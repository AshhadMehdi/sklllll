import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Tab<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({ tabs, value, onChange, className, layoutId = 'tabs' }: { tabs: Tab<T>[]; value: T; onChange: (v: T) => void; className?: string; layoutId?: string }) {
  return (
    <div className={cn('flex rounded-2xl bg-slate-100 p-1', className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} className={cn('relative flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition', active ? 'text-ink' : 'text-slate-500 hover:text-slate-700')}>
            {active && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-xl bg-white shadow-sm" transition={{ type: 'spring', damping: 30, stiffness: 400 }} />}
            <span className="relative inline-flex items-center gap-1.5">
              {t.label}
              {t.count != null && t.count > 0 && <span className={cn('rounded-full px-1.5 text-[11px]', active ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600')}>{t.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ScrollTabs<T extends string>({ tabs, value, onChange, className }: { tabs: Tab<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4', className)}>
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} className={cn('chip', t.id === value ? 'border-ink bg-ink text-white' : 'border-slate-200 bg-white text-slate-700')}>
          {t.label}
          {t.count != null && t.count > 0 && <span className={cn('rounded-full px-1.5 text-[11px]', t.id === value ? 'bg-white/20' : 'bg-slate-100')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
