'use client';

import { QueryProvider } from './QueryProvider';
import { AuthProvider } from './AuthProvider';
import { ScanProvider } from './ScanProvider';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ScanProvider>{children}</ScanProvider>
        <Toaster
          position="top-right"
          theme="light"
          richColors
          closeButton
          toastOptions={{ style: { background: '#fffbf3', border: '1px solid #e3d2a9', color: '#2a2013' } }}
        />
      </AuthProvider>
    </QueryProvider>
  );
}
