import { prisma } from '@/lib/prisma';
import type { ActivityCategory } from '@prisma/client';
import { getUserProfileSettings } from '@/lib/user-profile-settings';
import { getEngineAchievements } from '@/lib/achievement-engine';
const CATEGORY_DETAILS={RUN:{label:'Run',colour:'bg-orange-400'},CYCLE:{label:'Cycle',colour:'bg-sky-400'},SWIM:{label:'Swim',colour:'bg-cyan-300'},WALK_OR_HIKE:{label:'Walk / Hike',colour:'bg-emerald-400'},TROOP_GAMES:{label:'Troop Games',colour:'bg-violet-400'}} as const;
export type ProfileAchievement={name:string;description:string;unlocked:boolean;progress:number;category:'Milestones'|'Consistency'|'Social'|'Variety'|'Competition';tier:'bronze'|'silver'|'gold';progressLabel:string;};
type ProfileActivity={id:string;category:ActivityCategory;distance:number;pace:number|null;duration:number|null;elevationGain:number|null;points:number;completedWithFriend:boolean;companion:string|null;proofUrl:string|null;stravaActivityId:string|null;occurredAt:Date;weekNumber:number;};
type ProfileWeekScore={weekNumber:number;weekStart:Date;totalPoints:number;runPoints:number;cyclePoints:number;swimPoints:number;hikePoints:number;troopGamePoints:number;};
type ProfileUser={id:string;name:string;createdAt:Date;column:{id:string;name:string}|null;weeklyScores:ProfileWeekScore[];};
type RankedScore={userId:string;_sum:{totalPoints:number|null};};
type CategoryScore={category:ActivityCategory;_sum:{points:number|null};};
export async function getParticipantProfile(userId:string,options:{includeActivities?:boolean}={}){
  const includeActivities=options.includeActivities ?? true;
  const activityWhere={userId,status:'APPROVED' as const};
  const [userResult,rankedScoresResult,profileSettings,activityCount,friendActivities,categoryScoresResult,activitiesResult,engineAchievements]=await Promise.all([
    prisma.user.findUnique({where:{id:userId},select:{id:true,name:true,createdAt:true,column:{select:{id:true,name:true}},weeklyScores:{orderBy:{weekStart:'asc'},select:{weekNumber:true,weekStart:true,totalPoints:true,runPoints:true,cyclePoints:true,swimPoints:true,hikePoints:true,troopGamePoints:true}}}}),
    prisma.weeklyScore.groupBy({by:['userId'],_sum:{totalPoints:true},orderBy:{_sum:{totalPoints:'desc'}}}),
    getUserProfileSettings(userId),prisma.activity.count({where:activityWhere}),prisma.activity.count({where:{...activityWhere,completedWithFriend:true}}),
    prisma.activity.groupBy({by:['category'],where:activityWhere,_sum:{points:true}}),
    includeActivities?prisma.activity.findMany({where:activityWhere,orderBy:{occurredAt:'desc'},select:{id:true,category:true,distance:true,pace:true,duration:true,elevationGain:true,points:true,completedWithFriend:true,companion:true,stravaActivityId:true,occurredAt:true,weekNumber:true}}):Promise.resolve([] as ProfileActivity[]),
    getEngineAchievements(userId),
  ]);
  const user=userResult as ProfileUser|null;const rankedScores=rankedScoresResult as RankedScore[];const categoryScores=categoryScoresResult as CategoryScore[];const activities=(activitiesResult as ProfileActivity[]).map(activity=>({...activity,proofUrl:null}));
  if(!user)return null;
  const weeklyScoresByNumber=new Map<number,ProfileWeekScore>();
  for(const week of user.weeklyScores){const existing=weeklyScoresByNumber.get(week.weekNumber);if(existing){existing.totalPoints+=week.totalPoints;existing.runPoints+=week.runPoints;existing.cyclePoints+=week.cyclePoints;existing.swimPoints+=week.swimPoints;existing.hikePoints+=week.hikePoints;existing.troopGamePoints+=week.troopGamePoints;}else{weeklyScoresByNumber.set(week.weekNumber,{...week});}}
  const weeklyScores=Array.from(weeklyScoresByNumber.values()).sort((a,b)=>a.weekNumber-b.weekNumber);
  const totalPoints=weeklyScores.reduce((sum,week)=>sum+week.totalPoints,0);
  const rankIndex=rankedScores.findIndex((entry)=>entry.userId===user.id);const rank=rankIndex>=0?rankIndex+1:null;
  const scoreByCategory=new Map(categoryScores.map((row)=>[row.category,row._sum.points ?? 0]));
  const categories=(Object.keys(CATEGORY_DETAILS) as ActivityCategory[]).map((key)=>({key,...CATEGORY_DETAILS[key],points:scoreByCategory.get(key) ?? 0}));
  const activeCategories=categories.filter((category)=>category.points>0).length;
  const bestWeek=weeklyScores.reduce<ProfileWeekScore|null>((best,week)=>(!best||week.totalPoints>best.totalPoints?week:best),null);
  // Milestones are persisted by the database engine. Current-rank badges stay
  // live and do not claim a permanent historical rank or award bonus points.
  const rankBadges:ProfileAchievement[]=[
    {name:'Top 10',description:'Currently rank in the overall top 10',unlocked:Boolean(totalPoints>0&&rank&&rank<=10),progress:rank&&totalPoints>0?Math.min(1,10/rank):0,category:'Competition',tier:'silver',progressLabel:rank?`Current rank #${rank}`:'Not ranked yet'},
    {name:'Podium',description:'Currently rank in the overall top 3',unlocked:Boolean(totalPoints>0&&rank&&rank<=3),progress:rank&&totalPoints>0?Math.min(1,3/rank):0,category:'Competition',tier:'gold',progressLabel:rank?`Current rank #${rank}`:'Not ranked yet'},
    {name:'Number One',description:'Hold the #1 overall position',unlocked:totalPoints>0&&rank===1,progress:rank&&totalPoints>0?Math.min(1,1/rank):0,category:'Competition',tier:'gold',progressLabel:rank?`Current rank #${rank}`:'Not ranked yet'},
  ];
  return {...user,activities,activityCount,weeklyScores,totalPoints,rank,participantCount:rankedScores.length,categories,friendActivities,activeCategories,bestWeek,achievements:[...engineAchievements,...rankBadges],bio:profileSettings?.bio ?? '',profilePhotoUrl:profileSettings?.profilePhotoUrl ?? null};
}
