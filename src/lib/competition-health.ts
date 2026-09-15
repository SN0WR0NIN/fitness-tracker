import { prisma } from '@/lib/prisma';
import { activityReviewFlags, type ReviewFlagActivity } from '@/lib/activity-review-flags';
import { getWeekNumber, getWeekStart } from '@/lib/scoring';
import { getActiveSeason } from '@/lib/seasons';
import { getLatestOperationalBackupSummary } from '@/lib/system-automation';
import { getWeekFinalizationStates } from '@/lib/week-finalization';

export type CompetitionHealth={currentWeek:number;pending:number;rejectedThisWeek:number;flaggedPending:number;inactiveParticipants:number;nearTargetParticipants:number;participantCount:number;finalizedWeeks:number;completedWeeks:number;columns:Array<{id:string;name:string;members:number;active:number;participationPct:number}>;backup:{createdAt:Date;activities:number}|null;};
type ParticipantRow={id:string};
type ActivityRow={id:string;category:string;distance:number;pace:number|null;duration:number|null;proofUrl:string|null;proofUrls:string[];stravaActivityId:string|null;status:string;occurredAt:Date;createdAt:Date;user:{id:string}};
type WeeklyRow={userId:string;totalPoints:number};
type ColumnRow={id:string;name:string;members:number};
type ApprovedRow={userId:string;columnId:string};

export async function getCompetitionHealth():Promise<CompetitionHealth>{
  const season=await getActiveSeason();const now=new Date();const currentWeek=Math.max(1,getWeekNumber(now,season.startDate));const currentWeekStart=getWeekStart(now);
  const [participantResult,activityResult,weeklyResult,columnResult,backup,locks]=await Promise.all([
    prisma.user.findMany({where:{columnId:{not:null}},select:{id:true}}),
    prisma.activity.findMany({where:{occurredAt:{gte:season.startDate,lte:season.endDate},status:{not:'REJECTED'}},select:{id:true,category:true,distance:true,pace:true,duration:true,proofUrl:true,proofUrls:true,stravaActivityId:true,status:true,occurredAt:true,createdAt:true,user:{select:{id:true}}}}),
    prisma.weeklyScore.findMany({where:{weekStart:currentWeekStart},select:{userId:true,totalPoints:true}}),
    prisma.$queryRawUnsafe(`SELECT c.id,c.name,COUNT(u.id)::int AS members FROM "Column" c LEFT JOIN "User" u ON u."columnId"=c.id WHERE c."isActive"=true GROUP BY c.id,c.name ORDER BY c.name`) as Promise<ColumnRow[]>,
    getLatestOperationalBackupSummary(),getWeekFinalizationStates(season),
  ]);
  const participantRows=participantResult as ParticipantRow[],activityRows=activityResult as ActivityRow[],weeklyRows=weeklyResult as WeeklyRow[],columnRows=columnResult as ColumnRow[];
  const activityCandidates:ReviewFlagActivity[]=activityRows.map((item:ActivityRow)=>({id:item.id,user:{id:item.user.id},category:item.category,distance:item.distance,pace:item.pace,duration:item.duration,proofUrl:item.proofUrl,proofUrls:item.proofUrls,stravaActivityId:item.stravaActivityId,status:item.status,occurredAt:item.occurredAt.toISOString(),createdAt:item.createdAt.toISOString()}));
  const flaggedPending=activityCandidates.filter((item:ReviewFlagActivity)=>item.status==='PENDING'&&activityReviewFlags(item,activityCandidates).length>0).length;
  const approvedThisWeek=await prisma.activity.findMany({where:{status:'APPROVED',weekNumber:currentWeek,occurredAt:{gte:season.startDate,lte:season.endDate}},select:{userId:true,columnId:true}}) as ApprovedRow[];
  const activeUsers=new Set(approvedThisWeek.map((row:ApprovedRow)=>row.userId));const activeByColumn=new Map<string,Set<string>>();for(const row of approvedThisWeek){const set=activeByColumn.get(row.columnId)??new Set<string>();set.add(row.userId);activeByColumn.set(row.columnId,set);}
  const pending=activityCandidates.filter((item:ReviewFlagActivity)=>item.status==='PENDING').length;const rejectedThisWeek=await prisma.activity.count({where:{status:'REJECTED',weekNumber:currentWeek,occurredAt:{gte:season.startDate,lte:season.endDate}}});const nearTargetParticipants=weeklyRows.filter((row:WeeklyRow)=>row.totalPoints>=season.weeklyGoal*.8&&row.totalPoints<season.weeklyGoal).length;
  const todaySg=new Date(now.getTime()+8*3600000);const todayKey=Date.UTC(todaySg.getUTCFullYear(),todaySg.getUTCMonth(),todaySg.getUTCDate());const completedWeeks=locks.filter(lock=>Date.parse(lock.weekEnd.toISOString().slice(0,10)+'T00:00:00Z')<todayKey).length;
  return{currentWeek,pending,rejectedThisWeek,flaggedPending,inactiveParticipants:participantRows.filter((user:ParticipantRow)=>!activeUsers.has(user.id)).length,nearTargetParticipants,participantCount:participantRows.length,finalizedWeeks:locks.filter(lock=>lock.status==='FINALIZED').length,completedWeeks,columns:columnRows.map((column:ColumnRow)=>{const active=activeByColumn.get(column.id)?.size??0;const members=column.members;return{id:column.id,name:column.name,members,active,participationPct:members?Math.round(active/members*100):0};}).sort((a:{participationPct:number;name:string},b:{participationPct:number;name:string})=>a.participationPct-b.participationPct||a.name.localeCompare(b.name)),backup:backup?{createdAt:backup.createdAt,activities:backup.counts.activities??0}:null};
}
