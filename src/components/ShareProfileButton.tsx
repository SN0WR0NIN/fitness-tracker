'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

export default function ShareProfileButton({ participantName, profilePath }: { participantName: string; profilePath?: string }) {
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
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/10"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Share2 className="h-4 w-4" />}
      {copied ? 'Link copied' : 'Share profile'}
    </button>
  );
}
