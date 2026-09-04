'use client';

import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';

type Announcement = { id: string; title: string; message: string };

export default function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/announcements', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() : [])
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((error) => { if (error instanceof Error && error.name !== 'AbortError') console.error('Unable to load announcements:', error); });
    return () => controller.abort();
  }, []);
  const item = items.find((announcement) => !dismissed.has(announcement.id));
  if (!item) return null;
  return <div className="border-b border-orange-400/20 bg-orange-400/10 px-4 py-2.5 text-slate-900 dark:text-orange-100"><div className="mx-auto flex max-w-7xl items-start gap-3 text-sm"><Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /><p className="min-w-0 flex-1"><strong>{item.title}:</strong> {item.message}</p><button type="button" onClick={() => setDismissed((current) => new Set(current).add(item.id))} aria-label="Dismiss announcement"><X className="h-4 w-4" /></button></div></div>;
}
