'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import PwaManager from '@/components/PwaManager';
import WebVitalsReporter from '@/components/WebVitalsReporter';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <PwaManager>{children}</PwaManager>
        <WebVitalsReporter />
      </ThemeProvider>
    </SessionProvider>
  );
}
