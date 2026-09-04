'use client';

import { useEffect, useState } from 'react';
import { Download, Share2, WifiOff, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function PwaManager() {
  const [online, setOnline] = useState(true);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const ios = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
    queueMicrotask(() => {
      setOnline(window.navigator.onLine);
      setDismissed(window.sessionStorage.getItem('kg-install-dismissed') === 'true');
      if (ios && !standalone) setShowIOSHelp(true);
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((error) => console.error('Service worker registration failed:', error));
    }

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setShowIOSHelp(false);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    window.sessionStorage.setItem('kg-install-dismissed', 'true');
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setInstallEvent(null);
  };

  return (
    <>
      {!online ? <div role="status" className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-amber-300/20 bg-slate-900/95 px-4 py-3 text-sm text-amber-100 shadow-2xl backdrop-blur"><WifiOff className="h-5 w-5 shrink-0 text-amber-300" /><span><strong>Offline.</strong> Activity drafts keep saving on this device.</span></div> : null}
      {online && !dismissed && (installEvent || showIOSHelp) ? (
        <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-sky-300/20 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-sky-400/10 p-2.5 text-sky-300">{showIOSHelp && !installEvent ? <Share2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}</span>
            <div className="min-w-0 flex-1"><p className="font-black">Install KG Active</p><p className="mt-1 text-xs leading-5 text-slate-400">{showIOSHelp && !installEvent ? 'Tap Share, then Add to Home Screen for the app experience.' : 'Add it to your phone for quicker access and an app-like display.'}</p></div>
            <button type="button" onClick={dismiss} aria-label="Dismiss install prompt" className="rounded-lg p-1 text-slate-500 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          {installEvent ? <button type="button" onClick={install} className="mt-3 w-full rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-black text-slate-950">Install app</button> : null}
        </div>
      ) : null}
    </>
  );
}
