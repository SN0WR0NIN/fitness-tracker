import Link from 'next/link';
import { notFound,redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import Navbar from '@/components/Navbar';
import ActivityCorrectionForm from '@/components/ActivityCorrectionForm';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getChallengeSettings } from '@/lib/admin-control';
import { correctionSnapshot } from '@/lib/activity-corrections';
import { getOperatingState } from '@/lib/operating-mode';
import { singaporeDate } from '@/lib/activity-date';

export const dynamic='force-dynamic';
export default async function CorrectionPage({params}:{params:Promise<{id:string}>}) {
  const session=await getServerSession(authOptions);
  if(!session?.user?.id)redirect('/auth/login');
  const {id}=await params;
  const activity=await prisma.activity.findFirst({where:{id,userId:session.user.id}});
  if(!activity)notFound();
  const [settings,state,users,open]=await Promise.all([getChallengeSettings(),getOperatingState(),prisma.user.findMany({where:{id:{not:session.user.id},role:'MEMBER',columnId:{not:null}},select:{id:true,name:true},orderBy:{name:'asc'}}),prisma.$queryRaw<Array<{id:string}>>`SELECT id::text FROM app_internal.activity_correction WHERE activity_id=${id} AND status='OPEN'`]);
  const endDate=[settings.endDate.toISOString().slice(0,10),singaporeDate()].sort()[0];
  return <div className="min-h-screen bg-slate-950 text-white"><Navbar/><main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6"><Link href="/dashboard" className="font-bold text-lime-300">← My activities</Link><h1 className="text-3xl font-black">Request activity correction</h1>{activity.status!=='APPROVED'?<p>Only approved entries require a correction request. Edit pending entries from your dashboard.</p>:open.length?<section className="space-y-3 rounded-xl border border-sky-300/30 p-5"><p>This activity already has an open correction request.</p><Link href="/corrections" className="inline-flex min-h-11 items-center font-bold text-sky-200">Track or cancel my request →</Link></section>:<ActivityCorrectionForm activityId={id} original={correctionSnapshot(activity)} users={users} startDate={settings.startDate.toISOString().slice(0,10)} endDate={endDate} locked={state.mode!=='NORMAL'} strava={Boolean(activity.stravaActivityId)}/>}</main></div>;
}
