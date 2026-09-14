import { after, NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveColumnIds } from '@/lib/admin-control';
import { captureRankingSnapshot, getRankingDynamics } from '@/lib/ranking-dynamics';
import { getWeekStart } from '@/lib/scoring';
import { getActiveSeason } from '@/lib/seasons';
import { requestLog, timed } from '@/lib/telemetry';

type WeeklyScoreRow = {
  userId: string;
  totalPoints: number;
  runPoints: number;
  cyclePoints: number;
  swimPoints: number;
  hikePoints: number;
  troopGamePoints: number;
  user: { name: string; column: { name: string } | null } | null;
};
type TeamColumn = { id: string; name: string; _count: { members: number } };
type TeamActivityTotal = { columnId: string; _sum: { points: number | null } };
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
function calendarDate(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); }
function movementBaselineStart(weekNumber: number | null, challengeStart: Date) {
  const challengeDay = calendarDate(challengeStart);
  if (weekNumber === 1) return challengeDay;
  const firstSunday = getWeekStart(challengeDay);
  if (weekNumber && weekNumber > 1) return new Date(firstSunday.getTime() + (weekNumber - 1) * WEEK_MS);
  const currentWeekStart = getWeekStart(new Date());
  return currentWeekStart.getTime() < challengeDay.getTime() ? challengeDay : currentWeekStart;
}
function scheduleRankingCapture(scope: string, periodKey: string, entities: Array<{ id: string; points: number }>) {
  after(async () => { try { await captureRankingSnapshot(scope, periodKey, entities); } catch (error) { console.error('Failed to capture ranking snapshot:', error); } });
}

export async function GET(request: NextRequest) {
  const log = requestLog(request, '/api/leaderboard');
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'individual';
    const weekNumber = searchParams.get('weekNumber');
    const timingMeta = { route: '/api/leaderboard', type, period: weekNumber ? `week:${weekNumber}` : 'all-time' };
    const season = await timed('perf.leaderboard.season', () => getActiveSeason(), timingMeta);
    if (type === 'individual') {
      const response = await timed('perf.leaderboard.individual.total', () => getIndividualLeaderboard(weekNumber, season), timingMeta);
      log.success({ status: response.status, type, weekNumber }); return response;
    }
    if (type === 'team') {
      const response = await timed('perf.leaderboard.team.total', () => getTeamLeaderboard(weekNumber, season), timingMeta);
      log.success({ status: response.status, type, weekNumber }); return response;
    }
    log.success({ status: 400, type }); return NextResponse.json({ error: 'Invalid leaderboard type' }, { status: 400 });
  } catch (error) {
    log.failure(error, { status: 500 }); return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}

type SeasonInput={seasonKey:string;startDate:Date;endDate:Date};
async function getIndividualLeaderboard(weekNumber: string | null, season: SeasonInput) {
  let parsedWeek: number | null = null;
  if (weekNumber) { parsedWeek = Number.parseInt(weekNumber, 10); if (!Number.isFinite(parsedWeek) || parsedWeek < 1) return NextResponse.json({ error: 'Invalid week number' }, { status: 400 }); }
  const seasonWeekStart=getWeekStart(season.startDate),seasonWeekEnd=getWeekStart(season.endDate);
  const where={weekStart:{gte:seasonWeekStart,lte:seasonWeekEnd},...(parsedWeek?{weekNumber:parsedWeek}:{})};
  const meta = { route: '/api/leaderboard', type: 'individual', period: parsedWeek ? `week:${parsedWeek}` : 'all-time' };
  const weeklyScores = await timed('perf.leaderboard.individual.scores', () => prisma.weeklyScore.findMany({ where, include:{user:{select:{id:true,name:true,column:{select:{name:true}}}}}, orderBy:{totalPoints:'desc'} }), meta) as WeeklyScoreRow[];
  const userScores = new Map<string,{userId:string;userName:string;columnName:string;totalPoints:number;runPoints:number;cyclePoints:number;swimPoints:number;hikePoints:number;troopGamePoints:number}>();
  for (const score of weeklyScores) {
    const existing=userScores.get(score.userId);
    if(existing){existing.totalPoints+=score.totalPoints;existing.runPoints+=score.runPoints;existing.cyclePoints+=score.cyclePoints;existing.swimPoints+=score.swimPoints;existing.hikePoints+=score.hikePoints;existing.troopGamePoints+=score.troopGamePoints;}
    else userScores.set(score.userId,{userId:score.userId,userName:score.user?.name||'',columnName:score.user?.column?.name||'Unknown',totalPoints:score.totalPoints,runPoints:score.runPoints,cyclePoints:score.cyclePoints,swimPoints:score.swimPoints,hikePoints:score.hikePoints,troopGamePoints:score.troopGamePoints});
  }
  const leaderboard=Array.from(userScores.values()).sort((a,b)=>b.totalPoints-a.totalPoints);
  const periodKey=`season:${season.seasonKey}:${parsedWeek?`week:${parsedWeek}`:'all-time'}`;
  const rankedEntities=leaderboard.map(entry=>({id:entry.userId,points:entry.totalPoints}));
  const dynamics=await timed('perf.leaderboard.individual.dynamics',()=>getRankingDynamics('individual',periodKey,rankedEntities,movementBaselineStart(parsedWeek,season.startDate)),meta);
  scheduleRankingCapture('individual',periodKey,rankedEntities);
  return NextResponse.json({type:'individual',seasonKey:season.seasonKey,weekNumber:parsedWeek,leaderboard:leaderboard.map(entry=>({...entry,...dynamics.get(entry.userId)}))});
}

async function getTeamLeaderboard(weekNumber: string | null, season: SeasonInput) {
  const parsedWeek=weekNumber?Number.parseInt(weekNumber,10):null;
  if(weekNumber&&(!Number.isFinite(parsedWeek)||(parsedWeek??0)<1))return NextResponse.json({error:'Invalid week number'},{status:400});
  const meta={route:'/api/leaderboard',type:'team',period:parsedWeek?`week:${parsedWeek}`:'all-time'};
  const activeColumnIds=await timed('perf.leaderboard.team.active_columns',()=>getActiveColumnIds(),meta);
  const [columnsResult,totalsResult]=await Promise.all([
    timed('perf.leaderboard.team.columns',()=>prisma.column.findMany({where:{id:{in:activeColumnIds}},select:{id:true,name:true,_count:{select:{members:true}}}}),meta),
    timed('perf.leaderboard.team.totals',()=>prisma.activity.groupBy({by:['columnId'],where:{status:'APPROVED',columnId:{in:activeColumnIds},occurredAt:{gte:season.startDate,lte:season.endDate},...(parsedWeek?{weekNumber:parsedWeek}:{})},_sum:{points:true}}),meta),
  ]);
  const columns=columnsResult as TeamColumn[],totals=totalsResult as TeamActivityTotal[];const totalsByColumn=new Map(totals.map(row=>[row.columnId,row._sum.points??0]));
  const leaderboard=columns.map(column=>{const totalPoints=totalsByColumn.get(column.id)??0,memberCount=column._count.members;return{columnId:column.id,columnName:column.name,memberCount,totalPoints:Math.round(totalPoints*100)/100,averagePoints:memberCount>0?Math.round(totalPoints/memberCount*100)/100:0};}).sort((a,b)=>b.totalPoints-a.totalPoints);
  const periodKey=`season:${season.seasonKey}:${parsedWeek?`week:${parsedWeek}`:'all-time'}`;
  const rankedEntities=leaderboard.map(entry=>({id:entry.columnId,points:entry.totalPoints}));
  const dynamics=await timed('perf.leaderboard.team.dynamics',()=>getRankingDynamics('column',periodKey,rankedEntities,movementBaselineStart(parsedWeek,season.startDate)),meta);
  scheduleRankingCapture('column',periodKey,rankedEntities);
  return NextResponse.json({type:'team',seasonKey:season.seasonKey,weekNumber:parsedWeek,leaderboard:leaderboard.map(entry=>({...entry,...dynamics.get(entry.columnId)}))});
}
