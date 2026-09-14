import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWeekStart } from '@/lib/scoring';
import { getSeasons } from '@/lib/seasons';
import { getSeasonRecords } from '@/lib/season-records';

export const dynamic='force-dynamic';

type ScoreRow={userId:string;points:number};
type UserWeek={weekNumber:number;totalPoints:number};
type ActivitySummary={activities:number;distance:number;buddies:number};

export async function GET(){
  const session=await getServerSession(authOptions);const userId=session?.user?.id;if(!userId)return NextResponse.json({error:'Not authenticated'},{status:401});
  try{
    const seasons=await getSeasons();
    const summaries=[];
    for(const season of seasons){
      const firstWeek=getWeekStart(season.startDate),lastWeek=getWeekStart(season.endDate);
      const [rankRows,userWeeks,activityRows,recordData]=await Promise.all([
        prisma.$queryRawUnsafe(`SELECT ws."userId",SUM(ws."totalPoints")::float AS points FROM "WeeklyScore" ws WHERE ws."weekStart">=$1 AND ws."weekStart"<=$2 GROUP BY ws."userId" ORDER BY points DESC,ws."userId"`,firstWeek,lastWeek) as Promise<ScoreRow[]>,
        prisma.weeklyScore.findMany({where:{userId,weekStart:{gte:firstWeek,lte:lastWeek}},select:{weekNumber:true,totalPoints:true},orderBy:{weekNumber:'asc'}}) as Promise<UserWeek[]>,
        prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS activities,COALESCE(SUM(CASE WHEN category='SWIM' THEN distance/1000.0 WHEN category='TROOP_GAMES' THEN 0 ELSE distance END),0)::float AS distance,COUNT(*) FILTER (WHERE "completedWithFriend")::int AS buddies FROM "Activity" WHERE status='APPROVED' AND "userId"=$1 AND "occurredAt">=$2 AND "occurredAt"<=$3`,userId,season.startDate,season.endDate) as Promise<ActivitySummary[]>,
        getSeasonRecords(season.seasonKey),
      ]);
      const rankIndex=rankRows.findIndex(row=>row.userId===userId);const points=rankIndex>=0?rankRows[rankIndex].points:0;const bestWeek=userWeeks.reduce<UserWeek|null>((best,row)=>!best||row.totalPoints>best.totalPoints?row:best,null);const activity=activityRows[0]??{activities:0,distance:0,buddies:0};
      summaries.push({seasonKey:season.seasonKey,challengeName:season.challengeName,startDate:season.startDate,endDate:season.endDate,status:season.status,rank:rankIndex>=0?rankIndex+1:null,participantCount:rankRows.length,points,activities:activity.activities,distanceKm:activity.distance,buddySessions:activity.buddies,bestWeek:bestWeek?{weekNumber:bestWeek.weekNumber,points:bestWeek.totalPoints}:null,recordsHeld:recordData.records.filter(record=>record.holderId===userId).map(record=>({key:record.key,label:record.label,value:record.displayValue}))});
    }
    return NextResponse.json({seasons:summaries},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){console.error('Unable to load participant season history:',error);return NextResponse.json({error:'Unable to load season history.'},{status:500});}
}
