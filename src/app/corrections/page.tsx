import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listCorrections } from '@/lib/activity-corrections';
import { getOperatingState } from '@/lib/operating-mode';
import Navbar from '@/components/Navbar';
import CorrectionReviewList from '@/components/CorrectionReviewList';
export const dynamic='force-dynamic';
export default async function MyCorrectionsPage(){
  const session=await getServerSession(authOptions);if(!session?.user?.id)redirect('/auth/login');
  const [items,state]=await Promise.all([listCorrections(session.user.id),getOperatingState()]);
  return <div className="min-h-screen bg-slate-950 text-white"><Navbar/><main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6"><Link href="/dashboard" className="font-bold text-lime-300">← My activities</Link><h1 className="text-3xl font-black">My correction requests</h1><p className="text-slate-400">The most recent 100 requests. Open requests appear first; your scores change only after approval.</p><CorrectionReviewList items={items.map((item)=>({...item,createdAt:item.createdAt.toISOString(),reviewedAt:item.reviewedAt?.toISOString() ?? null}))} locked={state.mode!=='NORMAL'}/></main></div>;
}
