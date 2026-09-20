import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useConfig } from '@/hooks/useConfig';

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: (o: Record<string, unknown>) => void; renderButton: (el: HTMLElement, o: Record<string, unknown>) => void } } };
  }
}

/** Renders the Google Identity Services button when GOOGLE_CLIENT_ID is configured on the server. */
export function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const { config } = useConfig();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!config.googleClientId || !ref.current) return;
    const render = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({ client_id: config.googleClientId, callback: (r: { credential: string }) => onCredential(r.credential) });
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', width: ref.current.offsetWidth, shape: 'pill', text: 'continue_with' });
    };
    if (window.google) render();
    else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = render;
      s.onerror = () => toast.error('Could not load Google Sign-In');
      document.head.appendChild(s);
    }
  }, [config.googleClientId, onCredential]);
  if (!config.googleClientId) return null;
  return <div ref={ref} className="flex justify-center" />;
}
