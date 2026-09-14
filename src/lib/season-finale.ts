import { prisma } from '@/lib/prisma';
import { getWeekStart } from '@/lib/scoring';
import { getSeasonRecords, type SeasonRecord } from '@/lib/season-records';
import { getActiveSeason, getSeasonByKey, seasonPhase } from '@/lib/seasons';

export type FinaleStanding={userId:string;name:string;columnName:string;points:number;rank:number};
export type FinaleColumn={columnId:string;name:string;points:number;rank:number;activeAthletes:number};
export type CategoryWinner={category:string;label:string;userId:string;name:string;points:number};
export type PersonalFinale={rank:number;points:number;activities:number;distanceKm:number;buddySessions:number}|null;
export type SeasonFinale={seasonKey:string;challengeName:string;startDate:string;endDate:string;phase:'UPCOMING'|'LIVE'|'COMPLETE';champion:FinaleStanding|null;topThree:FinaleStanding[];winningColumn:FinaleColumn|null;columns:FinaleColumn[];categoryWinners:CategoryWinner[];records:SeasonRecord[];totalPoints:number;activityCount:number;activeAthletes:number;personal:PersonalFinale};

const labels:Record<string,string>={RUN:'Run',CYCLE:'Cycle',SWIM:'Swim',WALK_OR_HIKE:'Walk / Hike',TROOP_GAMES:'Troop Games'};

export async function getSeasonFinale(seasonKey?:string,userId?:string|null):Promise<SeasonFinale>{
  const season=seasonKey?await getSeasonByKey(seasonKey):await getActiveSeason();if(!season)throw new Error('Season not found.');
  const firstWeek=getWeekStart(season.startDate),lastWeek=getWeekStart(season.endDate);
  const [athleteRows,columnRows,categoryRows,summaryRows,recordData]=await Promise.all([
    prisma.$queryRawUnsafe(`SELECT ws."userId",u.name,COALESCE(c.name,'No column') AS "columnName",SUM(ws."totalPoints")::float AS points FROM "WeeklyScore" ws JOIN "User" u ON u.id=ws."userId" LEFT JOIN "Column" c ON c.id=u."columnId" WHERE ws."weekStart">=$1 AND ws."weekStart"<=$2 GROUP BY ws."userId",u.name,c.name ORDER BY points DESC,u.name ASC`,firstWeek,lastWeek) as Promise<Array<{userId:string;name:string;columnName:string;points:number}>>,
    prisma.$queryRawUnsafe(`SELECT a."columnId",c.name,SUM(a.points)::float AS points,COUNT(DISTINCT a."userId")::int AS "activeAthletes" FROM "Activity" a JOIN "Column" c ON c.id=a."columnId" WHERE a.status='APPROVED' AND a."occurredAt">=$1 AND a."occurredAt"<=$2 GROUP BY a."columnId",c.name ORDER BY points DESC,c.name ASC`,season.startDate,season.endDate) as Promise<Array<{columnId:string;name:string;points:number;activeAthletes:number}>>,
    prisma.$queryRawUnsafe(`SELECT a.category::text AS category,a."userId",u.name,SUM(a.points)::float AS points FROM "Activity" a JOIN "User" u ON u.id=a."userId" WHERE a.status='APPROVED' AND a."occurredAt">=$1 AND a."occurredAt"<=$2 GROUP BY a.category,a."userId",u.name ORDER BY category,points DESC,u.name ASC`,season.startDate,season.endDate) as Promise<Array<{category:string;userId:string;name:string;points:number}>>,
    prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(points),0)::float AS points,COUNT(*)::int AS activities,COUNT(DISTINCT "userId")::int AS athletes FROM "Activity" WHERE status='APPROVED' AND "occurredAt">=$1 AND "occurredAt"<=$2`,season.startDate,season.endDate) as Promise<Array<{points:number;activities:number;athletes:number}>>,
    getSeasonRecords(season.seasonKey),
  ]);
  const standings=athleteRows.map((row,index)=>({...row,rank:index+1}));
  const columns=columnRows.map((row,index)=>({...row,rank:index+1}));
  const winners:CategoryWinner[]=[];for(const category of Object.keys(labels)){const row=categoryRows.find(item=>item.category===category);if(row)winners.push({...row,label:labels[category]});}
  let personal:PersonalFinale=null;
  if(userId){const standing=standings.find(row=>row.userId===userId);if(standing){const metrics=await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS activities,COALESCE(SUM(CASE WHEN category='SWIM' THEN distance/1000.0 WHEN category='TROOP_GAMES' THEN 0 ELSE distance END),0)::float AS distance,COUNT(*) FILTER (WHERE "completedWithFriend")::int AS buddies FROM "Activity" WHERE status='APPROVED' AND "userId"=$1 AND "occurredAt">=$2 AND "occurredAt"<=$3`,userId,season.startDate,season.endDate) as Array<{activities:number;distance:number;buddies:number}>;personal={rank:standing.rank,points:standing.points,activities:metrics[0]?.activities??0,distanceKm:metrics[0]?.distance??0,buddySessions:metrics[0]?.buddies??0};}}
  const summary=summaryRows[0]??{points:0,activities:0,athletes:0};
  return{seasonKey:season.seasonKey,challengeName:season.challengeName,startDate:season.startDate.toISOString(),endDate:season.endDate.toISOString(),phase:seasonPhase(season),champion:standings[0]??null,topThree:standings.slice(0,3),winningColumn:columns[0]??null,columns,categoryWinners:winners,records:recordData.records,totalPoints:summary.points,activityCount:summary.activities,activeAthletes:summary.athletes,personal};
}
