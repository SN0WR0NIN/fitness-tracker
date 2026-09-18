import Link from 'next/link';
import { notFound,redirect } from 'next/navigation';
import { getAppSession } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import ActivityCorrectionForm from '@/components/ActivityCorrectionForm';
import { prisma } from '@/lib/prisma';
import { getChallengeSettings } from '@/lib/admin-control';
import { correctionSnapshot } from '@/lib/activity-corrections';
import { getOperatingState } from '@/lib/operating-mode';
import { singaporeDate } from '@/lib/activity-date';
import { isWeekFinalized } from '@/lib/week-finalization';

export const dynamic='force-dynamic';
export default async function CorrectionPage({params}:{params:Promise<{id:string}>}) {
  const session=await getAppSession();
  if(!session?.user?.id)redirect('/auth/login');
  const {id}=await params;
  const activity=await prisma.activity.findFirst({where:{id,userId:session.user.id}});
  if(!activity)notFound();
  const [settings,state,users,open,weekFinalized]=await Promise.all([
    getChallengeSettings(),
    getOperatingState(),
    prisma.user.findMany({where:{id:{not:session.user.id},columnId:{not:null}},select:{id:true,name:true},orderBy:{name:'asc'}}),
    prisma.$queryRaw<Array<{id:string}>>`SELECT id::text FROM app_internal.activity_correction WHERE activity_id=${id} AND status='OPEN'`,
    isWeekFinalized(activity.weekNumber),
  ]);
  const endDate=[settings.endDate.toISOString().slice(0,10),singaporeDate()].sort()[0];
  const locked=state.mode!=='NORMAL'||weekFinalized;
  return <div className="min-h-screen bg-slate-950 text-white"><Navbar/><main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6"><Link href="/activities/history" className="font-bold text-lime-300">← My Activities</Link><div><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">Approved activity</p><h1 className="mt-2 text-3xl font-black">Edit approved entry</h1><p className="mt-2 text-sm text-slate-400">Update the recorded details and submit them for admin review. Your current approved score stays in place until the edit is approved.</p></div>{activity.status!=='APPROVED'?<p>Only approved entries use this edit flow. Edit pending entries directly from My Activities.</p>:open.length?<section className="space-y-3 rounded-xl border border-sky-300/30 p-5"><p role="status">This activity already has an edit awaiting review. Your approved activity and points remain unchanged until that request is decided.</p><Link href="/corrections" className="inline-flex min-h-11 items-center font-bold text-sky-200">Track my edit request</Link></section>:<ActivityCorrectionForm activityId={id} original={correctionSnapshot(activity)} users={users} startDate={settings.startDate.toISOString().slice(0,10)} endDate={endDate} locked={locked} strava={Boolean(activity.stravaActivityId)}/>}</main></div>;
}
