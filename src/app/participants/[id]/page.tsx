import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Award,
  Bike,
  CalendarDays,
  Check,
  Footprints,
  Medal,
  Sparkles,
  Trophy,
  Users,
  Waves,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import ShareProfileButton from '@/components/ShareProfileButton';
import { formatDistance, formatDuration, formatPace } from '@/lib/format';
import { getParticipantProfile } from '@/lib/participant-profile';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Participant Profile · KG Stay Active Challenge', description: 'Participant progress, activity history, ranking, and achievements.' };

const categoryIcons={RUN:Footprints,CYCLE:Bike,SWIM:Waves,WALK_OR_HIKE:Activity,TROOP_GAMES:Users};
const categoryLabels={RUN:'Run',CYCLE:'Cycle',SWIM:'Swim',WALK_OR_HIKE:'Walk / Hike',TROOP_GAMES:'Troop Games'};

export default async function ParticipantProfilePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  // The public profile only renders 12 recent efforts. Avoid loading the full
  // approved activity history into every profile request.
  const profile=await getParticipantProfile(id,{activityLimit:12});
  if(!profile)notFound();
  const initials=profile.name.split(/\s+/).map(name=>name[0]).join('').slice(0,2).toUpperCase();
  const maxWeekPoints=Math.max(...profile.weeklyScores.map(week=>week.totalPoints),1);
  const unlocked=profile.achievements.filter(achievement=>achievement.unlocked);
  const activeWeeks=profile.weeklyScores.filter(week=>week.totalPoints>0).length;
  const topCategory=profile.categories.reduce<(typeof profile.categories)[number]|null>((best,item)=>!best||item.points>best.points?item:best,null);
  const showcase=unlocked.slice(-3).reverse();

  return <div className="min-h-screen bg-slate-950 text-white"><Navbar/><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <div className="flex items-center justify-between gap-3"><Link href="/leaderboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4"/>Back to leaderboard</Link><ShareProfileButton participantName={profile.name}/></div>

    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.2),_transparent_38%),radial-gradient(circle_at_80%_20%,_rgba(37,99,235,0.22),_transparent_34%)]"/>
      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex min-w-0 items-start gap-4 sm:items-center sm:gap-5"><div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 text-2xl font-black shadow-xl shadow-orange-500/20 sm:h-24 sm:w-24 sm:text-3xl">{profile.profilePhotoUrl?<Image src={profile.profilePhotoUrl} alt={`${profile.name}'s profile photo`} fill sizes="96px" className="object-cover" priority/>:initials}</div><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Athlete profile</p><h1 className="mt-2 truncate text-3xl font-black tracking-tight sm:text-5xl">{profile.name}</h1><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-300 sm:text-sm"><span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-sky-300"/>{profile.column?.name??'No column assigned'}</span><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-violet-300"/>Joined {profile.createdAt.toLocaleDateString('en-SG',{month:'short',year:'numeric'})}</span></div>{profile.bio?<p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{profile.bio}</p>:null}</div></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[34rem]"><HeroStat label="Overall rank" value={profile.rank?`#${profile.rank}`:'—'} detail={`of ${profile.participantCount}`}/><HeroStat label="Total points" value={profile.totalPoints.toFixed(1)} detail="season"/><HeroStat label="Activities" value={profile.activityCount.toString()} detail="approved"/><HeroStat label="Badges" value={unlocked.length.toString()} detail={`of ${profile.achievements.length}`}/></div>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Snapshot label="Best week" value={profile.bestWeek?`${profile.bestWeek.totalPoints.toFixed(1)} pts`:'—'} detail={profile.bestWeek?`Week ${profile.bestWeek.weekNumber}`:'No completed week'}/>
      <Snapshot label="Top sport" value={topCategory&&topCategory.points>0?topCategory.label:'—'} detail={topCategory&&topCategory.points>0?`${topCategory.points.toFixed(1)} points`:'No activity yet'}/>
      <Snapshot label="Active weeks" value={activeWeeks.toString()} detail="weeks with points"/>
      <Snapshot label="Buddy sessions" value={profile.friendActivities.toString()} detail="approved with friends"/>
    </section>

    {showcase.length?<section className="rounded-2xl border border-yellow-300/15 bg-gradient-to-r from-yellow-300/[0.08] to-orange-400/[0.04] p-5 sm:p-6"><div className="flex items-center gap-3"><span className="rounded-xl bg-yellow-300 p-2.5 text-slate-950"><Sparkles className="h-5 w-5"/></span><div><p className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">Achievement showcase</p><h2 className="mt-1 font-black">Latest unlocked badges</h2></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{showcase.map(item=><div key={item.name} className="rounded-xl border border-yellow-300/10 bg-black/15 p-4"><p className="font-black text-yellow-100">{item.name}</p><p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p></div>)}</div></section>:null}

    <details open className="dashboard-fold"><summary>Points · weekly progress</summary><section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"><SectionTitle icon={<Trophy className="h-5 w-5 text-yellow-300"/>} title="Weekly progress" subtitle="Points earned in every active week"/>{profile.weeklyScores.length?<div className="mt-8 flex h-56 items-end gap-3 overflow-x-auto border-b border-white/10 px-2 pb-1">{profile.weeklyScores.map(week=><div key={week.weekStart.toISOString()} className="flex h-full min-w-14 flex-1 flex-col justify-end text-center"><span className="mb-2 text-xs font-bold text-orange-300">{week.totalPoints.toFixed(1)}</span><div className="mx-auto w-full max-w-14 rounded-t-lg bg-gradient-to-t from-orange-600 to-yellow-300" style={{height:`${Math.max(8,week.totalPoints/maxWeekPoints*78)}%`}}/><span className="mt-2 text-xs text-slate-500">W{week.weekNumber}</span></div>)}</div>:<Empty message="No weekly progress yet."/>}</section></details>

    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <details open className="dashboard-fold"><summary>Recent activities</summary><section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"><div className="p-5 sm:p-6"><SectionTitle icon={<Activity className="h-5 w-5 text-emerald-300"/>} title="Recent activity" subtitle={`Latest approved efforts · ${profile.activityCount} total`}/></div>{profile.activities.length?<div>{profile.activities.map(activity=>{const Icon=categoryIcons[activity.category];return <div key={activity.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-white/5 px-5 py-4 sm:px-6"><span className="rounded-xl bg-white/5 p-2.5 text-slate-300"><Icon className="h-5 w-5"/></span><div className="min-w-0"><p className="font-bold">{categoryLabels[activity.category]}</p><p className="mt-1 text-xs text-slate-500">{activity.occurredAt.toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'})}{activity.distance?` · ${formatDistance(activity.distance)}${activity.category==='SWIM'?'m':'km'}`:''}{activity.duration?` · ${formatDuration(activity.duration)}`:''}{activity.pace?` · ${formatPace(activity.pace)}/km`:''}</p>{activity.completedWithFriend?<p className="mt-1 text-xs text-sky-300">With {activity.companion||'a friend'}</p>:null}</div><p className="font-black text-orange-300">+{activity.points.toFixed(1)}</p></div>;})}</div>:<Empty message="No approved activities yet."/>}</section></details>

      <aside className="space-y-6">
        <details open className="dashboard-fold"><summary>Performance mix</summary><section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"><SectionTitle icon={<Sparkles className="h-5 w-5 text-violet-300"/>} title="Performance mix" subtitle={`${profile.activeCategories} sports contributing points`}/><div className="mt-6 space-y-5">{profile.categories.map(category=><div key={category.key}><div className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-300">{category.label}</span><span className="font-black">{category.points.toFixed(1)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full ${category.colour}`} style={{width:`${profile.totalPoints?Math.max(category.points?3:0,category.points/profile.totalPoints*100):0}%`}}/></div></div>)}</div></section></details>
        <details className="dashboard-fold"><summary>All achievements</summary><section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"><SectionTitle icon={<Award className="h-5 w-5 text-yellow-300"/>} title="Achievements" subtitle={`${unlocked.length} of ${profile.achievements.length} unlocked`}/><div className="mt-6 space-y-3">{profile.achievements.map(achievement=><div key={achievement.name} className={`rounded-xl border p-4 ${achievement.unlocked?'border-yellow-400/20 bg-yellow-400/10':'border-white/5 bg-black/10'}`}><div className="flex items-start gap-3"><span className={`mt-0.5 rounded-lg p-2 ${achievement.unlocked?'bg-yellow-300 text-slate-950':'bg-white/5 text-slate-600'}`}>{achievement.unlocked?<Check className="h-4 w-4"/>:<Medal className="h-4 w-4"/>}</span><div className="min-w-0 flex-1"><p className={`font-bold ${achievement.unlocked?'text-yellow-100':'text-slate-400'}`}>{achievement.name}</p><p className="mt-1 text-xs text-slate-500">{achievement.description}</p>{!achievement.unlocked?<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-slate-500" style={{width:`${achievement.progress*100}%`}}/></div>:null}</div></div></div>)}</div></section></details>
      </aside>
    </div>
  </main></div>;
}

function HeroStat({label,value,detail}:{label:string;value:string;detail:string}){return <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;}
function Snapshot({label,value,detail}:{label:string;value:string;detail:string}){return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-[0.68rem] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-xl font-black sm:text-2xl">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;}
function SectionTitle({icon,title,subtitle}:{icon:React.ReactNode;title:string;subtitle:string}){return <div className="flex items-start gap-3"><span className="rounded-xl bg-white/5 p-2.5">{icon}</span><div><h2 className="text-lg font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div></div>;}
function Empty({message}:{message:string}){return <div className="p-10 text-center text-sm text-slate-500">{message}</div>;}
