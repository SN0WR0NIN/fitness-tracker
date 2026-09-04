'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, XCircle } from 'lucide-react';

type Notification = {
  id: string;
  type: 'success' | 'error';
  title: string;
  message: string;
  href: string;
  createdAt: string;
};

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/notifications', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() : [])
      .then((data) => {
        const nextNotifications = Array.isArray(data) ? data as Notification[] : [];
        const lastReadAt = window.localStorage.getItem(`kg-notifications-read:${userId}`);
        setNotifications(nextNotifications);
        if (lastReadAt) {
          const lastReadTime = new Date(lastReadAt).getTime();
          setSeenIds(new Set(nextNotifications.filter((notification) => new Date(notification.createdAt).getTime() <= lastReadTime).map((notification) => notification.id)));
        }
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== 'AbortError') console.error('Unable to load notifications:', error);
      });
    return () => controller.abort();
  }, [userId]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !seenIds.has(notification.id)).length,
    [notifications, seenIds]
  );

  const toggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      window.localStorage.setItem(`kg-notifications-read:${userId}`, new Date().toISOString());
      setSeenIds(new Set(notifications.map((notification) => notification.id)));
    }
  };

  return (
    <div className="relative">
      <button type="button" onClick={toggle} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open} className="relative rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
        <Bell className="h-5 w-5" />
        {unreadCount ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[0.6rem] font-black text-white">{Math.min(unreadCount, 9)}</span> : null}
      </button>
      {open ? (
        <div className="fixed inset-x-4 top-20 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-2 text-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between px-3 py-2"><div><p className="font-black">Notifications</p><p className="text-xs text-slate-500">Your latest activity reviews</p></div><span className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-400">{notifications.length}</span></div>
          {notifications.length ? notifications.map((notification) => {
            const Icon = notification.type === 'success' ? CheckCircle2 : XCircle;
            return <Link key={notification.id} href={notification.href} onClick={() => setOpen(false)} className="flex gap-3 rounded-xl border-t border-white/5 px-3 py-3 transition hover:bg-white/5"><Icon className={`mt-0.5 h-5 w-5 shrink-0 ${notification.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`} /><span className="min-w-0"><span className="block text-sm font-bold">{notification.title}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{notification.message}</span><span className="mt-1 block text-[0.65rem] text-slate-600">{new Date(notification.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</span></span></Link>;
          }) : <p className="px-3 py-8 text-center text-sm text-slate-500">No review updates yet.</p>}
        </div>
      ) : null}
    </div>
  );
}
