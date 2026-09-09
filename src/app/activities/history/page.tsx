import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { History } from 'lucide-react';
import Navbar from '@/components/Navbar';
import MyActivitiesHistory from '@/components/MyActivitiesHistory';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic='force-dynamic';

export default async function ActivityHistoryPage(){
  const session=await getServerSession(authOptions);const userId=session?.user?.id;if(!userId)redirect('/auth/login');
  const activities=await prisma.activity.findMany({where:{userId},orderBy:{occurredAt:'desc'},take:200,select:{id:true,category:true,distance:true,pace:true,duration:true,points:true,basePointsOverride:true,totalPointsOverride:true,pointsLog:{select:{basePoints:true,friendBonus:true,totalPoints:true}},completedWithFriend:true,companion:true,status:true,rejectionReason:true,proofUrl:true,proofUrls:true,occurredAt:true,stravaActivityId:true}});
  return <div className="min-h-screen bg-slate-950 text-white"><Navbar/><main className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><header className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_45%),rgba(255,255,255,0.04)] p-6 sm:p-8"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-orange-300"><History className="h-4 w-4"/>Activity history</p><h1 className="mt-3 text-3xl font-black sm:text-5xl">My activities</h1><p className="mt-3 max-w-2xl text-slate-400">Filter your submissions, open proof screenshots, understand each score, and request corrections without searching through the full profile dashboard.</p></header><MyActivitiesHistory activities={activities.map((activity: (typeof activities)[number])=>({...activity,occurredAt:activity.occurredAt.toISOString()}))}/></main></div>;
}
