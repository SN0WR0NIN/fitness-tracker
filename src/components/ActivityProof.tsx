'use client';
import Image from 'next/image';
import { ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ActivityProof({ proofUrl, label }: { proofUrl: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!proofUrl) return <p className="text-xs text-slate-500 lg:col-span-4">No screenshot attached.</p>;
  let preview = proofUrl;
  let valid = true;
  try {
    const url = new URL(proofUrl);
    if (!['https:', 'http:'].includes(url.protocol)) valid = false;
    if (url.hostname === 'drive.google.com') {
      const id = url.searchParams.get('id') || url.pathname.match(/\/d\/([^/]+)/)?.[1];
      if (id) preview = `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`;
    }
  } catch {
    valid = false;
  }
  if (!valid) return <p className="text-xs text-slate-500 lg:col-span-4">Screenshot link unavailable.</p>;
  const isGoogleDrive = preview.includes('drive.google.com');

  return <div className="lg:col-span-4">
    <button type="button" onClick={() => setOpen(true)} className="block w-full max-w-sm overflow-hidden rounded-xl border border-white/10 bg-black/20 text-left transition hover:border-orange-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300" aria-label={`Enlarge ${label}`}>
      {failed ? <p className="p-5 text-sm text-slate-400">Preview unavailable. Open the original screenshot.</p> : <div className="relative h-48 sm:h-56"><Image src={preview} alt={label} fill unoptimized={isGoogleDrive} loading="lazy" quality={68} sizes="(max-width: 640px) 92vw, 384px" className="object-contain" onError={() => setFailed(true)} /></div>}
      <p className="border-t border-white/10 px-4 py-2 text-xs font-semibold text-orange-300">Tap to enlarge</p>
    </button>

    {open && <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="relative flex h-full w-full max-w-6xl flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-slate-950/80 px-4 text-sm font-bold text-orange-300 hover:bg-white/10"><ExternalLink className="h-4 w-4" />Open original</a>
          <button type="button" onClick={() => setOpen(false)} autoFocus aria-label="Close screenshot" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-950/80 text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-slate-950"><Image src={preview} alt={label} fill unoptimized={isGoogleDrive} sizes="100vw" className="object-contain" /></div>
      </div>
    </div>}
  </div>;
}
