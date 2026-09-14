import { redirect } from 'next/navigation';
import Navbar from '@/components/Navbar';
import FlaggedReviewQueue from '@/components/FlaggedReviewQueue';
import { requireAdmin } from '@/lib/adminGuard';
import { activityReviewFlags } from '@/lib/activity-review-flags';
import { prisma } from '@/lib/prisma';
import { getActiveSeason } from '@/lib/seasons';

export const dynamic='force-dynamic';
export default async function AdminFlaggedPage(){
  const guard=await requireAdmin();if(guard.status===401)redirect('/auth/login');if(guard.error)redirect('/dashboard');
  const season=await getActiveSeason();
  const activities=await prisma.activity.findMany({where:{occurredAt:{gte:season.startDate,lte:season.endDate},status:{not:'REJECTED'}},orderBy:{createdAt:'asc'},select:{id:true,category:true,distance:true,pace:true,duration:true,proofUrl:true,proofUrls:true,stravaActivityId:true,status:true,occurredAt:true,createdAt:true,points:true,user:{select:{id:true,name:true}},column:{select:{name:true}}}});
  const candidates=activities.map(item=>({...item,status:item.status,occurredAt:item.occurredAt.toISOString(),createdAt:item.createdAt.toISOString(),user:{id:item.user.id}}));
  const rows=activities.filter(item=>item.status==='PENDING').map(item=>{const candidate=candidates.find(row=>row.id===item.id)!;return{item,flags:activityReviewFlags(candidate,candidates)};}).filter(row=>row.flags.length).map(({item,flags})=>({id:item.id,userId:item.user.id,userName:item.user.name,columnName:item.column.name,category:item.category,distance:item.distance,pace:item.pace,points:item.points,occurredAt:item.occurredAt.toISOString(),stravaActivityId:item.stravaActivityId,flags}));
  return <div className="min-h-screen bg-slate-950 text-white"><Navbar/><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><FlaggedReviewQueue initialRows={rows}/></main></div>;
}
