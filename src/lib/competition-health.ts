import { prisma } from '@/lib/prisma';
import { activityReviewFlags } from '@/lib/activity-review-flags';
import { getWeekNumber, getWeekStart } from '@/lib/scoring';
import { getActiveSeason } from '@/lib/seasons';
import { getLatestOperationalBackupSummary } from '@/lib/system-automation';
import { getWeekFinalizationStates } from '@/lib/week-finalization';

export type CompetitionHealth = {
  currentWeek: number;
  pending: number;
  rejectedThisWeek: number;
  flaggedPending: number;
  inactiveParticipants: number;
  nearTargetParticipants: number;
  participantCount: number;
  finalizedWeeks: number;
  completedWeeks: number;
  columns: Array<{ id:string; name:string; members:number; active:number; participationPct:number }>;
  backup: { createdAt: Date; activities: number } | null;
};

export async function getCompetitionHealth(): Promise<CompetitionHealth> {
  const season=await getActiveSeason();
  const now=new Date();
  const currentWeek=Math.max(1,getWeekNumber(now,season.startDate));
  const currentWeekStart=getWeekStart(now);
  const [participantRows,activityRows,weeklyRows,columnRows,backup,locks]=await Promise.all([
    prisma.user.findMany({where:{columnId:{not:null}},select:{id:true}}),
    prisma.activity.findMany({where:{occurredAt:{gte:season.startDate,lte:season.endDate},status:{not:'REJECTED'}},select:{id:true,category:true,distance:true,pace:true,duration:true,proofUrl:true,proofUrls:true,stravaActivityId:true,status:true,occurredAt:true,createdAt:true,user:{select:{id:true}}}}),
    prisma.weeklyScore.findMany({where:{weekStart:currentWeekStart},select:{userId:true,totalPoints:true}}),
    prisma.column.findMany({where:{isActive:true},select:{id:true,name:true,_count:{select:{members:true}}},orderBy:{name:'asc'}}),
    getLatestOperationalBackupSummary(),
    getWeekFinalizationStates(season),
  ]);
  const activityCandidates=activityRows.map(item=>({...item,occurredAt:item.occurredAt.toISOString(),createdAt:item.createdAt.toISOString(),user:{id:item.user.id}}));
  const flaggedPending=activityCandidates.filter(item=>item.status==='PENDING'&&activityReviewFlags(item,activityCandidates).length>0).length;
  const approvedThisWeek=await prisma.activity.findMany({where:{status:'APPROVED',weekNumber:currentWeek,occurredAt:{gte:season.startDate,lte:season.endDate}},select:{userId:true,columnId:true}});
  const activeUsers=new Set(approvedThisWeek.map(row=>row.userId));
  const activeByColumn=new Map<string,Set<string>>();for(const row of approvedThisWeek){const set=activeByColumn.get(row.columnId)??new Set<string>();set.add(row.userId);activeByColumn.set(row.columnId,set);}
  const pending=activityCandidates.filter(item=>item.status==='PENDING').length;
  const rejectedThisWeek=await prisma.activity.count({where:{status:'REJECTED',weekNumber:currentWeek,occurredAt:{gte:season.startDate,lte:season.endDate}}});
  const nearTargetParticipants=weeklyRows.filter(row=>row.totalPoints>=season.weeklyGoal*.8&&row.totalPoints<season.weeklyGoal).length;
  const todaySg=new Date(now.getTime()+8*3600000);const todayKey=Date.UTC(todaySg.getUTCFullYear(),todaySg.getUTCMonth(),todaySg.getUTCDate());
  const completedWeeks=locks.filter(lock=>Date.parse(lock.weekEnd.toISOString().slice(0,10)+'T00:00:00Z')<todayKey).length;
  return {
    currentWeek,pending,rejectedThisWeek,flaggedPending,
    inactiveParticipants:participantRows.filter(user=>!activeUsers.has(user.id)).length,
    nearTargetParticipants,participantCount:participantRows.length,
    finalizedWeeks:locks.filter(lock=>lock.status==='FINALIZED').length,completedWeeks,
    columns:columnRows.map(column=>{const active=activeByColumn.get(column.id)?.size??0;const members=column._count.members;return{id:column.id,name:column.name,members,active,participationPct:members?Math.round(active/members*100):0};}).sort((a,b)=>a.participationPct-b.participationPct||a.name.localeCompare(b.name)),
    backup:backup?{createdAt:backup.createdAt,activities:backup.counts.activities??0}:null,
  };
}
