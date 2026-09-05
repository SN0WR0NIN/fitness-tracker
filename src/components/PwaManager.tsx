'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { WifiOff } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type PwaInstallContextValue = {
  canInstall: boolean;
  showIOSInstructions: boolean;
  install: () => Promise<void>;
};

const PwaInstallContext = createContext<PwaInstallContextValue>({
  canInstall: false,
  showIOSInstructions: false,
  install: async () => {},
});

export function usePwaInstall() {
  return useContext(PwaInstallContext);
}

export default function PwaManager({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const ios = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
    queueMicrotask(() => {
      setOnline(window.navigator.onLine);
      setShowIOSInstructions(ios && !standalone);
    });

    const serviceWorkerTimer = 'serviceWorker' in navigator
      ? window.setTimeout(() => {
          navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((error) => console.error('Service worker registration failed:', error));
        }, 1600)
      : null;

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setShowIOSInstructions(false);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      if (serviceWorkerTimer !== null) window.clearTimeout(serviceWorkerTimer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setInstallEvent(null);
  }, [installEvent]);

  const installContext = useMemo(() => ({
    canInstall: Boolean(installEvent),
    showIOSInstructions,
    install,
  }), [installEvent, install, showIOSInstructions]);

  return (
    <PwaInstallContext.Provider value={installContext}>
      {children}
      {!online ? <div role="status" className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-amber-300/20 bg-slate-900/95 px-4 py-3 text-sm text-amber-100 shadow-2xl backdrop-blur"><WifiOff className="h-5 w-5 shrink-0 text-amber-300" /><span><strong>Offline.</strong> Activity drafts keep saving on this device.</span></div> : null}
    </PwaInstallContext.Provider>
  );
}
