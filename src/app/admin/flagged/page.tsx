import { redirect } from 'next/navigation';
import Navbar from '@/components/Navbar';
import FlaggedReviewQueue from '@/components/FlaggedReviewQueue';
import { requireAdmin } from '@/lib/adminGuard';
import { activityReviewFlags, type ActivityReviewFlag, type ReviewFlagActivity } from '@/lib/activity-review-flags';
import { prisma } from '@/lib/prisma';
import { getActiveSeason } from '@/lib/seasons';

export const dynamic='force-dynamic';
type ActivityRow={id:string;category:string;distance:number;pace:number|null;duration:number|null;proofUrl:string|null;proofUrls:string[];stravaActivityId:string|null;status:string;occurredAt:Date;createdAt:Date;points:number;user:{id:string;name:string};column:{name:string}};
type FlaggedRow={item:ActivityRow;flags:ActivityReviewFlag[]};

export default async function AdminFlaggedPage(){
  const guard=await requireAdmin();if(guard.status===401)redirect('/auth/login');if(guard.error)redirect('/dashboard');
  const season=await getActiveSeason();
  const activities=await prisma.activity.findMany({where:{occurredAt:{gte:season.startDate,lte:season.endDate},status:{not:'REJECTED'}},orderBy:{createdAt:'asc'},select:{id:true,category:true,distance:true,pace:true,duration:true,proofUrl:true,proofUrls:true,stravaActivityId:true,status:true,occurredAt:true,createdAt:true,points:true,user:{select:{id:true,name:true}},column:{select:{name:true}}}}) as ActivityRow[];
  const candidates:ReviewFlagActivity[]=activities.map((item:ActivityRow)=>({id:item.id,user:{id:item.user.id},category:item.category,distance:item.distance,pace:item.pace,duration:item.duration,proofUrl:item.proofUrl,proofUrls:item.proofUrls,stravaActivityId:item.stravaActivityId,status:item.status,occurredAt:item.occurredAt.toISOString(),createdAt:item.createdAt.toISOString()}));
  const rows=activities.filter((item:ActivityRow)=>item.status==='PENDING').map((item:ActivityRow):FlaggedRow=>{const candidate=candidates.find((row:ReviewFlagActivity)=>row.id===item.id)!;return{item,flags:activityReviewFlags(candidate,candidates)};}).filter((row:FlaggedRow)=>row.flags.length>0).map(({item,flags}:FlaggedRow)=>({id:item.id,userId:item.user.id,userName:item.user.name,columnName:item.column.name,category:item.category,distance:item.distance,pace:item.pace,points:item.points,occurredAt:item.occurredAt.toISOString(),stravaActivityId:item.stravaActivityId,flags}));
  return <div className="min-h-screen bg-slate-950 text-white"><Navbar/><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><FlaggedReviewQueue initialRows={rows}/></main></div>;
}
