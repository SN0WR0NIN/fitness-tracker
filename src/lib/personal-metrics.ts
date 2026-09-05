import { singaporeDate } from './activity-date';
import { getWeekNumber } from './scoring';
export type MetricActivity = { category: string; distance: number; pace: number | null; points: number; status: string; occurredAt: string; completedWithFriend: boolean };
export const metricCategories = [
  {key:'RUN',label:'Run',colour:'#b4ff45'}, {key:'CYCLE',label:'Cycle',colour:'#40d4f4'},
  {key:'SWIM',label:'Swim',colour:'#a78bfa'}, {key:'WALK_OR_HIKE',label:'Walk / Hike',colour:'#fb923c'},
  {key:'TROOP_GAMES',label:'Troop Games',colour:'#f472b6'},
];
export function personalMetrics(activities: MetricActivity[], today: string) {
  const rows = activities.filter(a=>a.status==='APPROVED');
  const dayMs=86400000, end=new Date(`${today}T00:00:00Z`).getTime();
  const days=Array.from({length:7},(_,i)=>{
    const date=new Date(end-(6-i)*dayMs).toISOString().slice(0,10);
    return {date,points:rows.filter(a=>singaporeDate(new Date(a.occurredAt))===date).reduce((s,a)=>s+a.points,0)};
  });
  const categories=metricCategories.map(c=>({...c,points:rows.filter(a=>a.category===c.key).reduce((s,a)=>s+a.points,0),distance:rows.filter(a=>a.category===c.key).reduce((s,a)=>s+a.distance/(c.key==='SWIM'?1000:1),0)}));
  const longest=(key:string)=>Math.max(0,...rows.filter(a=>a.category===key).map(a=>a.distance));
  const paces=rows.filter(a=>a.category==='RUN' && a.pace!==null && a.pace>0).map(a=>a.pace!);
  const uniqueDays=[...new Set(rows.map(a=>singaporeDate(new Date(a.occurredAt))))].sort();
  let streak=0,bestStreak=0,previous=0;
  for(const day of uniqueDays){const stamp=new Date(`${day}T00:00:00Z`).getTime();streak=stamp-previous===dayMs?streak+1:1;bestStreak=Math.max(bestStreak,streak);previous=stamp;}
  const weeks=new Map<number,number>();for(const a of rows){const week=getWeekNumber(new Date(a.occurredAt));if(week>0)weeks.set(week,(weeks.get(week)||0)+a.points);}
  const bestWeek=[...weeks].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0];
  return {days,categories,total:rows.reduce((s,a)=>s+a.points,0),longestRun:longest('RUN'),longestRide:longest('CYCLE'),longestSwim:longest('SWIM'),longestHike:longest('WALK_OR_HIKE'),fastestPace:paces.length?Math.min(...paces):null,bestWeek:bestWeek?{week:bestWeek[0],points:bestWeek[1]}:null,bestStreak,buddies:rows.filter(a=>a.completedWithFriend).length};
}
