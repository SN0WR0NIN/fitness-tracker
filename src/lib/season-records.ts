import { prisma } from '@/lib/prisma';
import { formatPace } from '@/lib/format';
import { getWeekStart } from '@/lib/scoring';
import { getActiveSeason, getSeasonByKey, type ChallengeSeason } from '@/lib/seasons';

export type SeasonRecord = { key:string; label:string; holderId:string|null; holderName:string; value:number; displayValue:string; detail:string };
type ActivityRow={id:string;userId:string;userName:string;category:string;distance:number;pace:number|null;points:number;completedWithFriend:boolean;occurredAt:Date};
type SnapshotRow={entityId:string;rank:number;points?:number;snapshotDate:Date};
async function resolveSeason(seasonKey?:string):Promise<ChallengeSeason>{if(!seasonKey)return getActiveSeason();const season=await getSeasonByKey(seasonKey);if(!season)throw new Error('Season not found.');return season;}

export async function getSeasonRecords(seasonKey?:string):Promise<{season:ChallengeSeason;records:SeasonRecord[]}>{
  const season=await resolveSeason(seasonKey);const firstWeek=getWeekStart(season.startDate),lastWeek=getWeekStart(season.endDate);
  const [activities,weeklyBestRows,snapshots]=await Promise.all([
    prisma.$queryRawUnsafe(`SELECT a.id,a."userId",u.name AS "userName",a.category::text,a.distance,a.pace,a.points,a."completedWithFriend",a."occurredAt" FROM "Activity" a JOIN "User" u ON u.id=a."userId" WHERE a.status='APPROVED' AND a."occurredAt">=$1 AND a."occurredAt"<=$2 ORDER BY a."occurredAt"`,season.startDate,season.endDate) as Promise<ActivityRow[]>,
    prisma.$queryRawUnsafe(`SELECT ws."userId",u.name AS "userName",ws."weekNumber",ws."totalPoints" FROM "WeeklyScore" ws JOIN "User" u ON u.id=ws."userId" WHERE ws."weekStart">=$1 AND ws."weekStart"<=$2 ORDER BY ws."totalPoints" DESC,u.name ASC LIMIT 1`,firstWeek,lastWeek) as Promise<Array<{userId:string;userName:string;weekNumber:number;totalPoints:number}>>,
    prisma.$queryRawUnsafe(`SELECT "entityId","rank","points","snapshotDate" FROM "RankingSnapshot" WHERE scope='individual' AND "snapshotDate">=$1::date AND "snapshotDate"<=$2::date AND ("periodKey"=$3 OR "periodKey"='all-time') ORDER BY "snapshotDate","capturedAt"`,season.startDate,season.endDate,`season:${season.seasonKey}:all-time`) as Promise<SnapshotRow[]>,
  ]);
  const longest=(category:string)=>[...activities].filter(a=>a.category===category).sort((a,b)=>b.distance-a.distance)[0]??null;
  const fastestRun=[...activities].filter(a=>a.category==='RUN'&&a.pace!==null&&a.pace>0).sort((a,b)=>a.pace!-b.pace!)[0]??null;
  const counts=new Map<string,{id:string;name:string;activities:number;buddies:number}>();for(const a of activities){const row=counts.get(a.userId)??{id:a.userId,name:a.userName,activities:0,buddies:0};row.activities+=1;if(a.completedWithFriend)row.buddies+=1;counts.set(a.userId,row);}const mostActivities=[...counts.values()].sort((a,b)=>b.activities-a.activities||a.name.localeCompare(b.name))[0]??null;const mostBuddies=[...counts.values()].sort((a,b)=>b.buddies-a.buddies||a.name.localeCompare(b.name))[0]??null;
  const snapshotGroups=new Map<string,SnapshotRow[]>();for(const row of snapshots){const week=getWeekStart(new Date(row.snapshotDate));const key=`${row.entityId}:${week.toISOString().slice(0,10)}`;const list=snapshotGroups.get(key)??[];list.push(row);snapshotGroups.set(key,list);}let climb:{userId:string;places:number}|null=null;for(const rows of snapshotGroups.values()){if(rows.length<2)continue;const places=rows[0].rank-rows[rows.length-1].rank;if(places>0&&(!climb||places>climb.places))climb={userId:rows[0].entityId,places};}
  let climbName='No movement recorded';if(climb){climbName=counts.get(climb.userId)?.name??(await prisma.user.findUnique({where:{id:climb.userId},select:{name:true}}))?.name??'Participant';}
  const weeklyBest=weeklyBestRows[0]??null;const run=longest('RUN'),ride=longest('CYCLE'),swim=longest('SWIM'),hike=longest('WALK_OR_HIKE');
  const activityRecord=(key:string,label:string,row:ActivityRow|null,unit:string,decimals=2):SeasonRecord=>({key,label,holderId:row?.userId??null,holderName:row?.userName??'No record yet',value:row?.distance??0,displayValue:row?`${row.distance.toFixed(decimals)} ${unit}`:'—',detail:row?`Approved ${new Date(row.occurredAt).toLocaleDateString('en-SG',{timeZone:'Asia/Singapore',day:'numeric',month:'short'})}`:'Waiting for an approved activity'});
  return{season,records:[
    {key:'weekly-points',label:'Highest weekly points',holderId:weeklyBest?.userId??null,holderName:weeklyBest?.userName??'No record yet',value:weeklyBest?.totalPoints??0,displayValue:weeklyBest?`${weeklyBest.totalPoints.toFixed(1)} pts`:'—',detail:weeklyBest?`Week ${weeklyBest.weekNumber}`:'No scored week yet'},
    activityRecord('longest-run','Longest run',run,'km'),activityRecord('longest-ride','Longest ride',ride,'km'),activityRecord('longest-swim','Longest swim',swim,'m',0),activityRecord('longest-hike','Longest walk / hike',hike,'km'),
    {key:'fastest-run',label:'Fastest run pace',holderId:fastestRun?.userId??null,holderName:fastestRun?.userName??'No record yet',value:fastestRun?.pace??0,displayValue:fastestRun?`${formatPace(fastestRun.pace!)}/km`:'—',detail:fastestRun?`${fastestRun.distance.toFixed(2)} km run`:'No qualifying run yet'},
    {key:'most-activities',label:'Most approved activities',holderId:mostActivities?.id??null,holderName:mostActivities?.name??'No record yet',value:mostActivities?.activities??0,displayValue:mostActivities?`${mostActivities.activities} activities`:'—',detail:'Season total'},
    {key:'most-buddies',label:'Most buddy sessions',holderId:mostBuddies?.id??null,holderName:mostBuddies?.name??'No record yet',value:mostBuddies?.buddies??0,displayValue:mostBuddies?`${mostBuddies.buddies} sessions`:'—',detail:'Approved friend activities'},
    {key:'biggest-climb',label:'Biggest weekly leaderboard climb',holderId:climb?.userId??null,holderName:climbName,value:climb?.places??0,displayValue:climb?`↑ ${climb.places} places`:'—',detail:'Start-of-week to latest position'},
  ]};
}
