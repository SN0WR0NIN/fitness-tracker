import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/adminGuard';
import { listCorrections } from '@/lib/activity-corrections';
import { getOperatingState } from '@/lib/operating-mode';
import Navbar from '@/components/Navbar';
import CorrectionReviewList from '@/components/CorrectionReviewList';
export const dynamic='force-dynamic';
export default async function AdminCorrectionsPage({searchParams}:{searchParams:Promise<{history?:string}>}){
  const guard=await requireAdmin();if(guard.status===401)redirect('/auth/login');if(guard.error)redirect('/dashboard');
  const history=(await searchParams).history==='true';
  const [items,state]=await Promise.all([listCorrections(null,history),getOperatingState()]);
  return <div className="min-h-screen bg-slate-950 text-white"><Navbar/><main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6"><Link href="/admin" className="font-bold text-lime-300">← Command Centre</Link><h1 className="text-3xl font-black">Activity correction requests</h1><p className="text-slate-400">Compare the original and proposed entry before deciding. Reasons, score changes and reviewer details are audited.</p><nav aria-label="Correction views" className="flex gap-3"><Link aria-current={!history?'page':undefined} href="/admin/corrections" className="rounded-xl border border-white/20 px-4 py-3">Open requests</Link><Link aria-current={history?'page':undefined} href="/admin/corrections?history=true" className="rounded-xl border border-white/20 px-4 py-3">History</Link><Link href="/admin/awards" className="px-4 py-3 text-sky-200">Weekly rebuilds</Link></nav><p className="text-xs text-slate-500">Showing up to 100 requests.</p><CorrectionReviewList admin items={items.map((item)=>({...item,createdAt:item.createdAt.toISOString(),reviewedAt:item.reviewedAt?.toISOString() ?? null}))} locked={state.mode==='READ_ONLY'}/></main></div>;
}
