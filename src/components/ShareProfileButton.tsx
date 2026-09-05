'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

export default function ShareProfileButton({ participantName, profilePath, iconOnly = false }: { participantName: string; profilePath?: string; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false);

  const shareProfile = async () => {
    const profileUrl = profilePath ? new URL(profilePath, window.location.origin).href : window.location.href;
    const shareData = {
      title: `${participantName} · KG Stay Active Challenge`,
      text: `See ${participantName}'s progress in the KG Stay Active Challenge.`,
      url: profileUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    await navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={shareProfile}
      aria-label={copied ? 'Link copied' : 'Share profile'}
      title={copied ? 'Link copied' : 'Share profile'}
      className={iconOnly ? 'inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-lime-300 focus-visible:ring-2 focus-visible:ring-lime-300' : 'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/10'}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Share2 className="h-4 w-4" />}
      <span className={iconOnly ? 'sr-only' : undefined} aria-live="polite">{copied ? 'Link copied' : 'Share profile'}</span>
    </button>
  );
}
