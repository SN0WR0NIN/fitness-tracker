import { singaporeDate } from './activity-date';
import { getScoreDisplayBreakdown, type ScoreBreakdown } from './score-explanation';
import { DEFAULT_SCORING_RULES, getWeekNumber, type ScoringRules } from './scoring';

export type MetricActivity = {
  category: string;
  distance: number;
  pace: number | null;
  points: number;
  status: string;
  occurredAt: string;
  completedWithFriend: boolean;
  pointsLog?: ScoreBreakdown | null;
};

export const metricCategories = [
  {key:'RUN',label:'Run',colour:'#b4ff45'},
  {key:'CYCLE',label:'Cycle',colour:'#40d4f4'},
  {key:'SWIM',label:'Swim',colour:'#a78bfa'},
  {key:'WALK_OR_HIKE',label:'Walk / Hike',colour:'#fb923c'},
  {key:'TROOP_GAMES',label:'Troop Games',colour:'#f472b6'},
];

const dayMs=86400000;
const dayStamp=(date:string)=>new Date(`${date}T00:00:00Z`).getTime();
const distanceKm=(activity:MetricActivity)=>activity.category==='SWIM'?activity.distance/1000:activity.category==='TROOP_GAMES'?0:activity.distance;
const activityDate=(activity:MetricActivity)=>singaporeDate(new Date(activity.occurredAt));

function weightedRunPace(rows:MetricActivity[]) {
  const runs=rows.filter(a=>a.category==='RUN'&&a.pace!==null&&a.pace>0);
  const distance=runs.reduce((sum,a)=>sum+a.distance,0);
  return distance>0?runs.reduce((sum,a)=>sum+a.pace!*a.distance,0)/distance:null;
}

function maxDistanceRecord(rows:MetricActivity[],category:string,todayStamp:number) {
  const candidates=rows.filter(a=>a.category===category&&a.distance>0).sort((a,b)=>new Date(a.occurredAt).getTime()-new Date(b.occurredAt).getTime());
  if(!candidates.length)return null;
  const record=candidates.reduce((best,row)=>row.distance>best.distance?row:best,candidates[0]);
  const recordTime=new Date(record.occurredAt).getTime();
  const prior=candidates.filter(row=>new Date(row.occurredAt).getTime()<recordTime);
  const previous=prior.length?Math.max(...prior.map(row=>row.distance)):null;
  const date=activityDate(record);
  return {
    value:record.distance,
    date,
    improvement:previous!==null?record.distance-previous:null,
    recent:todayStamp-dayStamp(date)>=0&&todayStamp-dayStamp(date)<=14*dayMs,
  };
}

function fastestPaceRecord(rows:MetricActivity[],todayStamp:number) {
  const candidates=rows.filter(a=>a.category==='RUN'&&a.pace!==null&&a.pace>0).sort((a,b)=>new Date(a.occurredAt).getTime()-new Date(b.occurredAt).getTime());
  if(!candidates.length)return null;
  const record=candidates.reduce((best,row)=>row.pace!<best.pace!?row:best,candidates[0]);
  const recordTime=new Date(record.occurredAt).getTime();
  const prior=candidates.filter(row=>new Date(row.occurredAt).getTime()<recordTime);
  const previous=prior.length?Math.min(...prior.map(row=>row.pace!)):null;
  const date=activityDate(record);
  return {
    value:record.pace!,
    date,
    improvementSeconds:previous!==null?Math.max(0,(previous-record.pace!)*60):null,
    recent:todayStamp-dayStamp(date)>=0&&todayStamp-dayStamp(date)<=14*dayMs,
  };
}

export function personalMetrics(activities: MetricActivity[], today: string, rules: ScoringRules = DEFAULT_SCORING_RULES) {
  const rows=activities.filter(a=>a.status==='APPROVED');
  const end=dayStamp(today);
  const dateRows=new Map<string,MetricActivity[]>();
  for(const activity of rows){
    const date=activityDate(activity);
    dateRows.set(date,[...(dateRows.get(date)||[]),activity]);
  }

  const days=Array.from({length:7},(_,i)=>{
    const date=new Date(end-(6-i)*dayMs).toISOString().slice(0,10);
    const dayActivities=dateRows.get(date)||[];
    return {
      date,
      points:dayActivities.reduce((s,a)=>s+a.points,0),
      distance:dayActivities.reduce((s,a)=>s+distanceKm(a),0),
      pace:weightedRunPace(dayActivities),
      activities:dayActivities.length,
    };
  });

  const categoryRows=(key:string)=>rows.filter(a=>a.category===key);
  const categories=metricCategories.map(c=>{
    const sportRows=categoryRows(c.key);
    return {
      ...c,
      points:sportRows.reduce((s,a)=>s+a.points,0),
      distance:sportRows.reduce((s,a)=>s+distanceKm(a),0),
      activities:sportRows.length,
      averagePace:c.key==='RUN'?weightedRunPace(sportRows):null,
      averagePoints:sportRows.length?sportRows.reduce((s,a)=>s+a.points,0)/sportRows.length:0,
    };
  });

  const runRows=categoryRows('RUN').filter(a=>a.pace!==null&&a.pace>0);
  const weightedPace=weightedRunPace(runRows);
  const uniqueDays=[...new Set(rows.map(activityDate))].sort();
  let streak=0,bestStreak=0,previous=0,bestStreakEnd:string|null=null;
  for(const day of uniqueDays){
    const stamp=dayStamp(day);
    streak=stamp-previous===dayMs?streak+1:1;
    if(streak>bestStreak){bestStreak=streak;bestStreakEnd=day;}
    previous=stamp;
  }
  const activeSet=new Set(uniqueDays);
  const anchor=activeSet.has(today)?end:activeSet.has(new Date(end-dayMs).toISOString().slice(0,10))?end-dayMs:null;
  let currentStreak=0;
  if(anchor!==null){for(let stamp=anchor;activeSet.has(new Date(stamp).toISOString().slice(0,10));stamp-=dayMs)currentStreak++;}

  const weekRows=new Map<number,MetricActivity[]>();
  for(const activity of rows){
    const week=getWeekNumber(new Date(activity.occurredAt));
    if(week>0)weekRows.set(week,[...(weekRows.get(week)||[]),activity]);
  }
  const weekSeries=[...weekRows.entries()].sort((a,b)=>a[0]-b[0]).map(([weekNumber,items])=>({
    weekNumber,
    points:items.reduce((s,a)=>s+a.points,0),
    distance:items.reduce((s,a)=>s+distanceKm(a),0),
    pace:weightedRunPace(items),
    activities:items.length,
  }));
  const bestWeek=[...weekSeries].sort((a,b)=>b.points-a.points||a.weekNumber-b.weekNumber)[0]??null;
  const currentWeek=getWeekNumber(new Date(`${today}T04:00:00Z`));
  const currentWeekData=weekSeries.find(item=>item.weekNumber===currentWeek);
  const previousWeekData=weekSeries.find(item=>item.weekNumber===currentWeek-1);
  const currentWeekPoints=currentWeekData?.points??0;
  const previousWeekPoints=previousWeekData?.points??0;
  const weekChange=previousWeekPoints>0?(currentWeekPoints-previousWeekPoints)/previousWeekPoints*100:null;
  const currentWeekRows=weekRows.get(currentWeek)||[];
  const currentWeekAveragePoints=currentWeekRows.length?currentWeekPoints/currentWeekRows.length:0;
  const currentWeekDayRows=[...dateRows.entries()]
    .map(([date,items])=>({date,items,week:getWeekNumber(new Date(items[0]?.occurredAt??`${date}T04:00:00Z`))}))
    .filter(item=>item.week===currentWeek)
    .map(item=>({date:item.date,points:item.items.reduce((s,a)=>s+a.points,0)}));
  const bestDay=[...currentWeekDayRows].sort((a,b)=>b.points-a.points||b.date.localeCompare(a.date))[0]??null;

  const scoreMix=rows.reduce((sum,activity)=>{
    if(!activity.pointsLog)return sum;
    const breakdown=getScoreDisplayBreakdown({
      category:activity.category,status:'APPROVED',points:activity.points,distance:activity.distance,pace:activity.pace,
      completedWithFriend:activity.completedWithFriend,pointsLog:activity.pointsLog,
    },activity.pointsLog,rules);
    sum.distancePoints+=breakdown.distancePoints;
    sum.pacePoints+=breakdown.pacePoints;
    sum.friendBonus+=breakdown.friendBonus;
    return sum;
  },{distancePoints:0,pacePoints:0,friendBonus:0});

  const total=rows.reduce((s,a)=>s+a.points,0);
  const totalDistance=rows.reduce((s,a)=>s+distanceKm(a),0);
  const strongest=[...categories].sort((a,b)=>b.points-a.points)[0];
  const personalBests={
    longestRun:maxDistanceRecord(rows,'RUN',end),
    longestRide:maxDistanceRecord(rows,'CYCLE',end),
    longestSwim:maxDistanceRecord(rows,'SWIM',end),
    longestHike:maxDistanceRecord(rows,'WALK_OR_HIKE',end),
    fastestPace:fastestPaceRecord(rows,end),
    bestWeek:bestWeek?{week:bestWeek.weekNumber,points:bestWeek.points}:null,
    bestStreak:{value:bestStreak,endDate:bestStreakEnd},
  };

  return {
    days,weekSeries,categories,total,totalDistance,
    approvedActivities:rows.length,activeDays:uniqueDays.length,averagePoints:rows.length?total/rows.length:0,
    longestRun:personalBests.longestRun?.value??0,longestRide:personalBests.longestRide?.value??0,
    longestSwim:personalBests.longestSwim?.value??0,longestHike:personalBests.longestHike?.value??0,
    fastestPace:personalBests.fastestPace?.value??null,averageRunPace:weightedPace,
    bestWeek:personalBests.bestWeek,bestStreak,currentStreak,
    buddies:rows.filter(a=>a.completedWithFriend).length,strongestSport:strongest&&strongest.points>0?strongest:null,
    currentWeek,currentWeekPoints,previousWeekPoints,weekChange,currentWeekAveragePoints,bestDay,
    scoreMix,personalBests,
  };
}
