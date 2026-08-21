'use client';

import { ThemeProvider } from './ThemeProvider';
import { QueryProvider } from './QueryProvider';
import { AuthProvider } from './AuthProvider';
import { ScanProvider } from './ScanProvider';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <ScanProvider>{children}</ScanProvider>
          <Toaster
            position="top-right"
            theme="dark"
            richColors
            closeButton
            toastOptions={{ style: { background: '#0d0d0d', border: '1px solid #242424', color: '#f5f5f5' } }}
          />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
