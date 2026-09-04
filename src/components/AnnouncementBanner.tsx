'use client';

import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';

type Announcement = { id: string; title: string; message: string };

export default function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/announcements', { cache: 'no-store' });
        const data = response.ok ? await response.json() : [];
        if (!active) return;
        const nextItems = Array.isArray(data) ? data as Announcement[] : [];
        const knownValue = window.localStorage.getItem('kg-announcements-known');
        const knownIds = new Set<string>(knownValue ? JSON.parse(knownValue) : []);
        if (knownValue && window.localStorage.getItem('kg-browser-alerts') === 'true' && 'Notification' in window && window.Notification.permission === 'granted' && 'serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await Promise.all(nextItems.filter((announcement) => !knownIds.has(announcement.id)).map((announcement) => registration.showNotification(announcement.title, { body: announcement.message, icon: '/app-icon.svg', tag: `announcement-${announcement.id}`, data: { url: '/' } })));
        }
        window.localStorage.setItem('kg-announcements-known', JSON.stringify(nextItems.map((announcement) => announcement.id)));
        setItems(nextItems);
      } catch (error) {
        if (active) console.error('Unable to load announcements:', error);
      }
    };
    void load();
    const interval = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  const item = items.find((announcement) => !dismissed.has(announcement.id));
  if (!item) return null;
  return <div className="border-b border-orange-400/20 bg-orange-400/10 px-4 py-2.5 text-slate-900 dark:text-orange-100"><div className="mx-auto flex max-w-7xl items-start gap-3 text-sm"><Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /><p className="min-w-0 flex-1"><strong>{item.title}:</strong> {item.message}</p><button type="button" onClick={() => setDismissed((current) => new Set(current).add(item.id))} aria-label="Dismiss announcement"><X className="h-4 w-4" /></button></div></div>;
}
