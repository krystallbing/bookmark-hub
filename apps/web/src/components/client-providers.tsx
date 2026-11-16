'use client';

import { AdminShell } from './admin-shell';
import { I18nProvider } from '@/lib/i18n';
import { useEffect } from 'react';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('bookmark-hub-theme') === 'blue' ? 'blue' : 'green';
  }, []);
  return (
    <I18nProvider>
      <AdminShell>{children}</AdminShell>
    </I18nProvider>
  );
}
