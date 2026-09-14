import { duplicateReason } from './activity-duplicates';

export type ActivityReviewFlag = {
  code: string;
  label: string;
  detail: string;
  level: 'review' | 'high';
};

export type ReviewFlagActivity = {
  id: string;
  user: { id: string };
  category: string;
  distance: number;
  pace: number | null;
  duration: number | null;
  proofUrl: string | null;
  proofUrls?: string[];
  stravaActivityId: string | null;
  status: string;
  occurredAt: string;
  createdAt: string;
};

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}

function distanceReviewThreshold(category: string) {
  if (category==='RUN') return {review:60,high:100};
  if (category==='CYCLE') return {review:200,high:300};
  if (category==='SWIM') return {review:10000,high:20000};
  if (category==='WALK_OR_HIKE') return {review:60,high:100};
  return null;
}

function distanceDeltaFloor(category: string) {
  if (category==='SWIM') return 1500;
  if (category==='CYCLE') return 30;
  return 8;
}

function overlapMinutes(a: ReviewFlagActivity, b: ReviewFlagActivity) {
  if (!a.duration || !b.duration || a.duration<=0 || b.duration<=0) return 0;
  const aStart=new Date(a.occurredAt).getTime(),bStart=new Date(b.occurredAt).getTime();
  const aEnd=aStart+a.duration*60000,bEnd=bStart+b.duration*60000;
  return Math.max(0,Math.min(aEnd,bEnd)-Math.max(aStart,bStart))/60000;
}

/** Advisory checks only. A flag never changes status, points, or approval eligibility. */
export function activityReviewFlags(activity: ReviewFlagActivity, all: ReviewFlagActivity[]): ActivityReviewFlag[] {
  const flags:ActivityReviewFlag[]=[];
  const duplicate=all.find(other=>duplicateReason(
    {...activity,userId:activity.user.id},
    {...other,userId:other.user.id},
  ));
  if(duplicate){
    const reason=duplicateReason({...activity,userId:activity.user.id},{...duplicate,userId:duplicate.user.id});
    if(reason)flags.push({code:'duplicate',label:'Possible duplicate',detail:reason,level:'high'});
  }

  const hasProof=Boolean(activity.proofUrl||activity.proofUrls?.length);
  if(activity.status==='PENDING'&&!hasProof&&!activity.stravaActivityId){
    flags.push({code:'evidence',label:'No verification source',detail:'No proof image or linked Strava activity is attached.',level:'review'});
  }

  if(activity.category==='RUN'&&activity.pace!==null&&activity.pace>0){
    if(activity.pace<3){
      flags.push({code:'pace-absolute',label:'Very fast run pace',detail:`Submitted pace is ${activity.pace.toFixed(2)} min/km. Verify the activity source.`,level:'high'});
    }else if(activity.pace<3.5){
      flags.push({code:'pace-absolute',label:'Fast run pace',detail:`Submitted pace is ${activity.pace.toFixed(2)} min/km. Review is recommended.`,level:'review'});
    }
  }

  const threshold=distanceReviewThreshold(activity.category);
  if(threshold&&activity.distance>threshold.review){
    flags.push({
      code:'distance-absolute',
      label:activity.distance>threshold.high?'Exceptional distance':'Long-distance activity',
      detail:`Distance is ${activity.distance.toFixed(activity.category==='SWIM'?0:2)}${activity.category==='SWIM'?' m':' km'}. Confirm the evidence before approval.`,
      level:activity.distance>threshold.high?'high':'review',
    });
  }

  const history=all.filter(other=>other.id!==activity.id&&other.user.id===activity.user.id&&other.category===activity.category&&other.status==='APPROVED'&&other.distance>0);
  if(history.length>=3&&activity.distance>0){
    const typical=median(history.map(item=>item.distance));
    const ratio=typical>0?activity.distance/typical:0;
    if(ratio>=2.5&&activity.distance-typical>=distanceDeltaFloor(activity.category)){
      flags.push({code:'distance-history',label:'Distance well above usual',detail:`This is ${ratio.toFixed(1)}× the participant's median approved ${activity.category.toLowerCase().replaceAll('_',' ')} distance.`,level:ratio>=4?'high':'review'});
    }
  }

  if(activity.category==='RUN'&&activity.pace!==null&&activity.pace>0){
    const paceHistory=all.filter(other=>other.id!==activity.id&&other.user.id===activity.user.id&&other.category==='RUN'&&other.status==='APPROVED'&&other.pace!==null&&other.pace>0).map(other=>other.pace!);
    if(paceHistory.length>=3){
      const typicalPace=median(paceHistory);
      const ratio=typicalPace>0?activity.pace/typicalPace:1;
      if(ratio<0.7){
        flags.push({code:'pace-history',label:'Pace much faster than usual',detail:`Pace is about ${Math.round((1-ratio)*100)}% faster than this participant's median approved run pace.`,level:ratio<0.55?'high':'review'});
      }
    }
  }

  const overlapping=all.find(other=>other.id!==activity.id&&other.user.id===activity.user.id&&other.status!=='REJECTED'&&overlapMinutes(activity,other)>=10);
  if(overlapping){
    flags.push({code:'overlap',label:'Overlapping activity time',detail:'This activity overlaps another non-rejected submission by at least 10 minutes.',level:'review'});
  }

  const occurred=new Date(activity.occurredAt).getTime(),created=new Date(activity.createdAt).getTime();
  if(Number.isFinite(occurred)&&Number.isFinite(created)&&occurred>created+15*60000){
    flags.push({code:'future-time',label:'Activity time is after submission',detail:'The recorded activity start time is more than 15 minutes after the submission time.',level:'high'});
  }

  if(activity.duration&&activity.duration>0&&activity.distance>0){
    const hours=activity.duration/60;
    const speed=activity.category==='SWIM'?null:activity.distance/hours;
    if(activity.category==='RUN'&&speed!==null&&speed>25)flags.push({code:'speed',label:'Unusually high run speed',detail:`Implied average speed is ${speed.toFixed(1)} km/h.`,level:'high'});
    if(activity.category==='CYCLE'&&speed!==null&&speed>65)flags.push({code:'speed',label:'Unusually high cycling speed',detail:`Implied average speed is ${speed.toFixed(1)} km/h.`,level:speed>80?'high':'review'});
    if(activity.category==='WALK_OR_HIKE'&&speed!==null&&speed>12)flags.push({code:'speed',label:'Unusually high walk/hike speed',detail:`Implied average speed is ${speed.toFixed(1)} km/h.`,level:'review'});
  }

  return flags.filter((flag,index,array)=>array.findIndex(item=>item.code===flag.code)===index);
}
