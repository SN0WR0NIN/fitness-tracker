import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { Award, Bell, CheckCircle2, Info, XCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { authOptions } from '@/lib/auth';
import { getUserNotifications } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) redirect('/auth/login');
  const notifications = await getUserNotifications(userId, 50);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-lime-300"><Bell className="h-4 w-4" />Your updates</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Notification Centre</h1>
          <p className="mt-2 text-sm text-slate-400">Weekly awards, finalized results, activity review outcomes and goal reminders in one place.</p>
        </header>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          {notifications.length ? notifications.map((notification) => {
            const Icon = notification.kind === 'WEEKLY_AWARD' ? Award : notification.type === 'success' ? CheckCircle2 : notification.type === 'error' ? XCircle : Info;
            const tone = notification.type === 'success' ? 'text-emerald-300' : notification.type === 'error' ? 'text-rose-300' : 'text-sky-300';
            return <Link key={notification.id} href={notification.href} className="flex gap-4 border-b border-white/5 px-5 py-4 transition last:border-0 hover:bg-white/[0.04]"><span className={`mt-0.5 ${tone}`}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black">{notification.title}</span><span className="mt-1 block text-sm leading-6 text-slate-400">{notification.message}</span><span className="mt-2 block text-[0.65rem] text-slate-600">{new Date(notification.createdAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span></Link>;
          }) : <div className="px-6 py-16 text-center"><Bell className="mx-auto h-9 w-9 text-slate-700" /><p className="mt-4 font-black">No notifications yet</p><p className="mt-2 text-sm text-slate-500">Activity reviews and weekly results will appear here.</p></div>}
        </section>
      </main>
    </div>
  );
}
