import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({ title, subtitle, back = true, action, className, transparent }: { title: ReactNode; subtitle?: ReactNode; back?: boolean | string; action?: ReactNode; className?: string; transparent?: boolean }) {
  const nav = useNavigate();
  return (
    <header className={cn('sticky top-0 z-30 flex items-center gap-3 px-4 py-3', !transparent && 'border-b border-slate-100 bg-white/90 backdrop-blur', className)}>
      {back && (
        <button onClick={() => (typeof back === 'string' ? nav(back) : window.history.length > 1 ? nav(-1) : nav('/home'))} aria-label="Back" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink shadow-sm ring-1 ring-slate-100 hover:bg-slate-50">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function DashHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
