import { useEffect, useState, type ReactNode } from 'react';
import { CloudOff, Loader2, RefreshCw, Server } from 'lucide-react';
import { API_BASE } from '@/lib/api';

type State = { status: 'checking' | 'ok' | 'waking' | 'missing' | 'down'; attempts: number; detail?: string };

const PROBE_TIMEOUT = 8000;
const MAX_WAKE_MS = 120_000; // Render free instances can take ~1 min to spin up

async function probe(): Promise<'ok' | 'missing' | 'down'> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT);
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: ctrl.signal, cache: 'no-store' });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.ok) return 'ok';
      return 'missing'; // HTML or something else answered on /api/health → no API behind this origin
    }
    // A static host (Vercel/Netlify) answers 404 for /api/* → there is no backend on this origin.
    if (res.status === 404 && !API_BASE) return 'missing';
    return 'down';
  } catch {
    return 'down';
  } finally {
    clearTimeout(t);
  }
}

/**
 * Production-only guard: makes sure the API is reachable before rendering the app.
 * - Waits (with retries) while a sleeping free-tier server wakes up.
 * - Explains what to do when the frontend was deployed to a static host without an API.
 */
export function BackendGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: import.meta.env.DEV ? 'ok' : 'checking', attempts: 0 });

  useEffect(() => {
    if (state.status === 'ok' || state.status === 'missing' || state.status === 'down') return;
    let cancelled = false;
    const started = Date.now();
    const run = async () => {
      while (!cancelled) {
        const r = await probe();
        if (cancelled) return;
        if (r === 'ok') return setState({ status: 'ok', attempts: 0 });
        if (r === 'missing') return setState({ status: 'missing', attempts: 0 });
        if (Date.now() - started > MAX_WAKE_MS) return setState((s) => ({ status: 'down', attempts: s.attempts + 1 }));
        setState((s) => ({ status: 'waking', attempts: s.attempts + 1 }));
        await new Promise((res) => setTimeout(res, 4000));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status === 'checking']);

  if (state.status === 'ok') return <>{children}</>;

  const retry = () => setState({ status: 'checking', attempts: 0 });
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  if (state.status === 'missing') {
    return (
      <Shell icon={<CloudOff className="h-7 w-7" />} title="Backend not connected">
        <p>
          This site is serving only the <b>web app</b>. There is no Qareeb API answering on <code className="rounded bg-slate-100 px-1">{origin}/api</code>, so nothing can load.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-left">
          <li>
            Deploy the API (the <code className="rounded bg-slate-100 px-1">server/</code> workspace) on a Node host — e.g. <b>Render</b> (New + → Blueprint → this repo) or <b>Railway</b>. See <code className="rounded bg-slate-100 px-1">DEPLOY.md</code>.
          </li>
          <li>
            In this site's hosting dashboard (Vercel/Netlify) add the environment variable <code className="rounded bg-slate-100 px-1">VITE_API_URL=https://your-api-host</code> and <b>redeploy</b>.
          </li>
        </ol>
        <p className="text-xs text-slate-500">Tip: the Render/Railway deployment already serves the full app on its own URL — you can use that directly instead.</p>
        <button onClick={retry} className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">
          <RefreshCw className="h-4 w-4" /> Check again
        </button>
      </Shell>
    );
  }

  if (state.status === 'down') {
    return (
      <Shell icon={<Server className="h-7 w-7" />} title="Can't reach the server">
        <p>
          The API at <code className="rounded bg-slate-100 px-1">{API_BASE || origin}</code> isn't responding. It may be down, still deploying, or blocked by CORS.
        </p>
        <button onClick={retry} className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </Shell>
    );
  }

  const slow = state.attempts >= 2;
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        <p className="text-sm font-semibold text-ink">{slow ? 'Waking up the server…' : 'Connecting…'}</p>
        {slow && <p className="max-w-xs text-xs text-slate-500">Free hosting plans put idle servers to sleep. The first request can take up to a minute — hang on.</p>}
      </div>
    </div>
  );
}

function Shell({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-5 py-10">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 text-center text-sm text-slate-600 shadow-card ring-1 ring-slate-100">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">{icon}</div>
        <h1 className="text-lg font-bold text-ink">{title}</h1>
        {children}
      </div>
    </div>
  );
}
