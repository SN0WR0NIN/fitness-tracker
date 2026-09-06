import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getNotificationPreferences } from '@/lib/notification-preferences';
import Navbar from '@/components/Navbar';
import NotificationPreferencesForm from '@/components/NotificationPreferencesForm';
export const dynamic='force-dynamic';
export default async function PreferencesPage(){const session=await getServerSession(authOptions);if(!session?.user?.id)redirect('/auth/login');return <div className="min-h-screen bg-slate-950 text-white"><Navbar/><main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6"><Link href="/account" className="font-bold text-lime-300">← Account settings</Link><h1 className="text-3xl font-black">Notification preferences</h1><NotificationPreferencesForm initial={await getNotificationPreferences(session.user.id)}/><Link href="/notifications" className="inline-flex min-h-11 items-center text-sky-200">Open Notification Centre →</Link></main></div>;}
