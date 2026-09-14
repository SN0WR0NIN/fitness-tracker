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
  {key:'RUN',label:'Run',colour:'#b4ff45'}, {key:'CYCLE',label:'Cycle',colour:'#40d4f4'},
  {key:'SWIM',label:'Swim',colour:'#a78bfa'}, {key:'WALK_OR_HIKE',label:'Walk / Hike',colour:'#fb923c'},
  {key:'TROOP_GAMES',label:'Troop Games',colour:'#f472b6'},
];

const dayMs=86400000;
const dayStamp=(date:string)=>new Date(`${date}T00:00:00Z`).getTime();
const distanceKm=(activity:MetricActivity)=>activity.category==='SWIM'?activity.distance/1000:activity.category==='TROOP_GAMES'?0:activity.distance;

export function personalMetrics(activities: MetricActivity[], today: string, rules: ScoringRules = DEFAULT_SCORING_RULES) {
  const rows = activities.filter(a=>a.status==='APPROVED');
  const end=dayStamp(today);
  const dateRows=new Map<string,MetricActivity[]>();
  for(const activity of rows){const date=singaporeDate(new Date(activity.occurredAt));dateRows.set(date,[...(dateRows.get(date)||[]),activity]);}

  const days=Array.from({length:7},(_,i)=>{
    const date=new Date(end-(6-i)*dayMs).toISOString().slice(0,10);
    const dayActivities=dateRows.get(date)||[];
    return {date,points:dayActivities.reduce((s,a)=>s+a.points,0),activities:dayActivities.length};
  });
  const consistency=Array.from({length:28},(_,i)=>{
    const date=new Date(end-(27-i)*dayMs).toISOString().slice(0,10);
    const dayActivities=dateRows.get(date)||[];
    return {date,points:dayActivities.reduce((s,a)=>s+a.points,0),activities:dayActivities.length,active:dayActivities.length>0};
  });

  const categories=metricCategories.map(c=>({...c,
    points:rows.filter(a=>a.category===c.key).reduce((s,a)=>s+a.points,0),
    distance:rows.filter(a=>a.category===c.key).reduce((s,a)=>s+distanceKm(a),0),
    activities:rows.filter(a=>a.category===c.key).length,
  }));
  const longest=(key:string)=>Math.max(0,...rows.filter(a=>a.category===key).map(a=>a.distance));
  const runRows=rows.filter(a=>a.category==='RUN' && a.pace!==null && a.pace>0);
  const paces=runRows.map(a=>a.pace!);
  const totalRunDistance=runRows.reduce((s,a)=>s+a.distance,0);
  const weightedRunPace=totalRunDistance>0?runRows.reduce((s,a)=>s+a.pace!*a.distance,0)/totalRunDistance:null;
  const uniqueDays=[...new Set(rows.map(a=>singaporeDate(new Date(a.occurredAt))))].sort();
  let streak=0,bestStreak=0,previous=0;
  for(const day of uniqueDays){const stamp=dayStamp(day);streak=stamp-previous===dayMs?streak+1:1;bestStreak=Math.max(bestStreak,streak);previous=stamp;}
  const activeSet=new Set(uniqueDays);
  const anchor=activeSet.has(today)?end:activeSet.has(new Date(end-dayMs).toISOString().slice(0,10))?end-dayMs:null;
  let currentStreak=0;
  if(anchor!==null){for(let stamp=anchor;activeSet.has(new Date(stamp).toISOString().slice(0,10));stamp-=dayMs)currentStreak++;}

  const weeks=new Map<number,number>();
  for(const a of rows){const week=getWeekNumber(new Date(a.occurredAt));if(week>0)weeks.set(week,(weeks.get(week)||0)+a.points);}
  const bestWeek=[...weeks].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0];
  const currentWeek=getWeekNumber(new Date(`${today}T04:00:00Z`));
  const currentWeekPoints=weeks.get(currentWeek)||0;
  const previousWeekPoints=weeks.get(currentWeek-1)||0;
  const weekChange=previousWeekPoints>0?(currentWeekPoints-previousWeekPoints)/previousWeekPoints*100:null;

  const scoreMix=rows.reduce((sum,activity)=>{
    if(!activity.pointsLog)return sum;
    const breakdown=getScoreDisplayBreakdown({category:activity.category,status:'APPROVED',points:activity.points,distance:activity.distance,pace:activity.pace,completedWithFriend:activity.completedWithFriend,pointsLog:activity.pointsLog},activity.pointsLog,rules);
    sum.distancePoints+=breakdown.distancePoints;
    sum.pacePoints+=breakdown.pacePoints;
    sum.friendBonus+=breakdown.friendBonus;
    return sum;
  },{distancePoints:0,pacePoints:0,friendBonus:0});

  const total=rows.reduce((s,a)=>s+a.points,0);
  const totalDistance=rows.reduce((s,a)=>s+distanceKm(a),0);
  const strongest=[...categories].sort((a,b)=>b.points-a.points)[0];
  return {
    days,consistency,categories,total,totalDistance,
    approvedActivities:rows.length,activeDays:uniqueDays.length,averagePoints:rows.length?total/rows.length:0,
    longestRun:longest('RUN'),longestRide:longest('CYCLE'),longestSwim:longest('SWIM'),longestHike:longest('WALK_OR_HIKE'),
    fastestPace:paces.length?Math.min(...paces):null,averageRunPace:weightedRunPace,
    bestWeek:bestWeek?{week:bestWeek[0],points:bestWeek[1]}:null,bestStreak,currentStreak,
    buddies:rows.filter(a=>a.completedWithFriend).length,strongestSport:strongest&&strongest.points>0?strongest:null,
    currentWeek, currentWeekPoints, previousWeekPoints, weekChange, scoreMix,
  };
}
