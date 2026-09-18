'use client';

import { ThemeProvider } from 'next-themes';
import PwaManager from '@/components/PwaManager';
import WebVitalsReporter from '@/components/WebVitalsReporter';
import { AppSessionProvider } from '@/lib/client-auth';

export default function Providers({ children, clerkEnabled }: { children: React.ReactNode; clerkEnabled: boolean }) {
  return (
    <AppSessionProvider enabled={clerkEnabled}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <PwaManager>{children}</PwaManager>
        <WebVitalsReporter />
      </ThemeProvider>
    </AppSessionProvider>
  );
}
