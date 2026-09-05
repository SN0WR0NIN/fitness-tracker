'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Award, Bell, BellRing, CheckCircle2, Info, XCircle } from 'lucide-react';

type ReviewNotification = {
  id: string;
  type: 'success' | 'error' | 'info';
  kind: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
};

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<ReviewNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if ('Notification' in window) setPermission(window.Notification.permission); });

    const load = async () => {
      try {
        const response = await fetch('/api/notifications', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        const nextNotifications = Array.isArray(data) ? data as ReviewNotification[] : [];
        const lastReadAt = window.localStorage.getItem(`kg-notifications-read:${userId}`);
        if (lastReadAt) {
          const lastReadTime = new Date(lastReadAt).getTime();
          setSeenIds(new Set(nextNotifications.filter((notification) => new Date(notification.createdAt).getTime() <= lastReadTime).map((notification) => notification.id)));
        }

        const knownKey = `kg-notifications-known:${userId}`;
        const knownValue = window.localStorage.getItem(knownKey);
        const knownIds = new Set<string>(knownValue ? JSON.parse(knownValue) : []);
        if (knownValue && window.localStorage.getItem('kg-browser-alerts') === 'true' && window.Notification.permission === 'granted' && 'serviceWorker' in navigator) {
          const newItems = nextNotifications.filter((notification) => !knownIds.has(notification.id));
          const registration = await navigator.serviceWorker.ready;
          await Promise.all(newItems.map((notification) => registration.showNotification(notification.title, { body: notification.message, icon: '/app-icon.svg', badge: '/app-icon.svg', tag: `kg-${notification.id}`, data: { url: notification.href } })));
        }
        window.localStorage.setItem(knownKey, JSON.stringify(nextNotifications.map((notification) => notification.id)));
        setNotifications(nextNotifications);
      } catch (error) {
        if (active) console.error('Unable to load notifications:', error);
      }
    };

    const initialLoad = window.setTimeout(() => void load(), 1000);
    const interval = window.setInterval(load, 60000);
    return () => { active = false; window.clearTimeout(initialLoad); window.clearInterval(interval); };
  }, [userId]);

  const unreadCount = useMemo(() => notifications.filter((notification) => !seenIds.has(notification.id)).length, [notifications, seenIds]);

  const toggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      window.localStorage.setItem(`kg-notifications-read:${userId}`, new Date().toISOString());
      setSeenIds(new Set(notifications.map((notification) => notification.id)));
    }
  };

  const enableAlerts = async () => {
    if (!('Notification' in window)) return;
    const result = await window.Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      window.localStorage.setItem('kg-browser-alerts', 'true');
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('KG Active alerts enabled', { body: 'Weekly awards, results and review updates can now appear here.', icon: '/app-icon.svg', data: { url: '/notifications' } });
    }
  };

  return (
    <div className="relative">
      <button type="button" onClick={toggle} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open} className="relative rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
        <Bell className="h-5 w-5" />
        {unreadCount ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[0.6rem] font-black text-white">{Math.min(unreadCount, 9)}</span> : null}
      </button>
      {open ? (
        <div className="fixed inset-x-4 top-20 z-[70] max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-2 text-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between px-3 py-2"><div><p className="font-black">Notifications</p><p className="text-xs text-slate-500">Awards, results, goals and reviews</p></div><span className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-400">{notifications.length}</span></div>
          {permission === 'default' ? <button type="button" onClick={enableAlerts} className="mx-2 mb-2 flex w-[calc(100%-1rem)] items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2.5 text-left text-xs font-bold text-sky-200"><BellRing className="h-4 w-4" />Enable browser alerts</button> : null}
          {permission === 'granted' ? <p className="mx-3 mb-2 text-[0.65rem] text-emerald-300">Browser alerts active while the app is running.</p> : null}
          {permission === 'denied' ? <p className="mx-3 mb-2 text-[0.65rem] text-amber-300">Alerts are blocked in browser settings.</p> : null}
          {notifications.length ? notifications.slice(0, 8).map((notification) => {
            const Icon = notification.kind === 'WEEKLY_AWARD' ? Award : notification.type === 'success' ? CheckCircle2 : notification.type === 'error' ? XCircle : Info;
            const tone = notification.type === 'success' ? 'text-emerald-300' : notification.type === 'error' ? 'text-rose-300' : 'text-sky-300';
            return <Link key={notification.id} href={notification.href} onClick={() => setOpen(false)} className="flex gap-3 rounded-xl border-t border-white/5 px-3 py-3 transition hover:bg-white/5"><Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`} /><span className="min-w-0"><span className="block text-sm font-bold">{notification.title}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{notification.message}</span><span className="mt-1 block text-[0.65rem] text-slate-600">{new Date(notification.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</span></span></Link>;
          }) : <p className="px-3 py-8 text-center text-sm text-slate-500">No updates yet.</p>}
          <Link href="/notifications" onClick={() => setOpen(false)} className="mt-1 block rounded-xl border-t border-white/5 px-3 py-3 text-center text-xs font-black text-lime-300 hover:bg-white/5">View all notifications</Link>
        </div>
      ) : null}
    </div>
  );
}
