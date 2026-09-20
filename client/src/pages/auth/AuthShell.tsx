import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { APP_NAME } from '@/lib/constants';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface md:grid md:place-items-center">
      <div className="mx-auto w-full max-w-md bg-white md:my-8 md:rounded-3xl md:shadow-card">
        <div className="px-6 pb-8 pt-10">
          <Link to="/welcome" className="inline-flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
            <span className="text-lg font-extrabold tracking-tight">{APP_NAME}</span>
          </Link>
          <h1 className="mt-6 text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
