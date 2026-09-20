import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';
import { registerServiceWorker } from './lib/push';
import { useTheme, useThemeSync } from './stores/theme';
import { BackendGate } from './components/common/BackendGate';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
  },
});

function Root() {
  useThemeSync();
  const isDark = useTheme((s) => s.isDark);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <BackendGate>
          <App />
        </BackendGate>
        <Toaster position="top-center" richColors closeButton theme={isDark ? 'dark' : 'light'} toastOptions={{ className: 'rounded-2xl! shadow-float!' }} />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);

registerServiceWorker();
