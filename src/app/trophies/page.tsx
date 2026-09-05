import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import TrophyCabinet from '@/components/TrophyCabinet';
import { authOptions } from '@/lib/auth';
import { getParticipantProfile } from '@/lib/participant-profile';

export const dynamic = 'force-dynamic';

export default async function TrophiesPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) redirect('/auth/login');

  const profile = await getParticipantProfile(userId, { includeActivities: false });
  if (!profile) redirect('/dashboard');

  return <div className="min-h-screen bg-slate-950 text-white"><Navbar /><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><div className="mb-6"><Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" />Back to athlete hub</Link></div><TrophyCabinet achievements={profile.achievements} /></main></div>;
}
