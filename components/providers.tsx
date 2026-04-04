'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { AppThemeProvider } from '@/lib/theme-context';
import ThemeSwitcher from './theme-switcher';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AppThemeProvider>
        {children}
        <ThemeSwitcher />
      </AppThemeProvider>
    </SessionProvider>
  );
}
