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
  ExternalLink,
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

export const metadata: Metadata = {
  title: 'Participant Profile · KG Stay Active Challenge',
  description: 'Participant progress, activity history, ranking, and achievements.',
};

const categoryIcons = {
  RUN: Footprints,
  CYCLE: Bike,
  SWIM: Waves,
  WALK_OR_HIKE: Activity,
  TROOP_GAMES: Users,
};

const categoryLabels = {
  RUN: 'Run',
  CYCLE: 'Cycle',
  SWIM: 'Swim',
  WALK_OR_HIKE: 'Walk / Hike',
  TROOP_GAMES: 'Troop Games',
};

export default async function ParticipantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getParticipantProfile(id);
  if (!profile) notFound();

  const initials = profile.name
    .split(/\s+/)
    .map((name) => name[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const maxWeekPoints = Math.max(...profile.weeklyScores.map((week) => week.totalPoints), 1);
  const unlockedAchievements = profile.achievements.filter((achievement) => achievement.unlocked).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/leaderboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to leaderboard
          </Link>
          <ShareProfileButton participantName={profile.name} />
        </div>

        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.2),_transparent_38%),radial-gradient(circle_at_80%_20%,_rgba(37,99,235,0.22),_transparent_34%)]" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 text-3xl font-black shadow-xl shadow-orange-500/20">
                {profile.profilePhotoUrl ? <Image src={profile.profilePhotoUrl} alt={`${profile.name}'s profile photo`} fill sizes="96px" className="object-cover" priority /> : initials}
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">Athlete profile</p>
                <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{profile.name}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-sky-300" />{profile.column?.name ?? 'No column assigned'}</span>
                  <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-violet-300" />Joined {profile.createdAt.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })}</span>
                </div>
                {profile.bio ? <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">{profile.bio}</p> : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[34rem]">
              <HeroStat label="Overall rank" value={profile.rank ? `#${profile.rank}` : '—'} detail={`of ${profile.participantCount}`} />
              <HeroStat label="Total points" value={profile.totalPoints.toFixed(1)} detail="all time" />
              <HeroStat label="Activities" value={profile.activities.length.toString()} detail="approved" />
              <HeroStat label="Badges" value={unlockedAchievements.toString()} detail={`of ${profile.achievements.length}`} />
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <SectionTitle icon={<Trophy className="h-5 w-5 text-yellow-300" />} title="Weekly progress" subtitle="Points earned in every active week" />
              {profile.weeklyScores.length ? (
                <div className="mt-8 flex h-56 items-end gap-3 overflow-x-auto border-b border-white/10 px-2 pb-1">
                  {profile.weeklyScores.map((week) => (
                    <div key={week.weekStart.toISOString()} className="flex h-full min-w-14 flex-1 flex-col justify-end text-center">
                      <span className="mb-2 text-xs font-bold text-orange-300">{week.totalPoints.toFixed(1)}</span>
                      <div className="mx-auto w-full max-w-14 rounded-t-lg bg-gradient-to-t from-orange-600 to-yellow-300 transition hover:brightness-110" style={{ height: `${Math.max(8, week.totalPoints / maxWeekPoints * 78)}%` }} />
                      <span className="mt-2 text-xs text-slate-500">W{week.weekNumber}</span>
                    </div>
                  ))}
                </div>
              ) : <Empty message="No weekly progress yet." />}
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <div className="p-5 sm:p-6">
                <SectionTitle icon={<Activity className="h-5 w-5 text-emerald-300" />} title="Activity history" subtitle="Latest approved efforts" />
              </div>
              {profile.activities.length ? (
                <div>
                  {profile.activities.slice(0, 12).map((activity) => {
                    const Icon = categoryIcons[activity.category];
                    return (
                      <div key={activity.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-white/5 px-5 py-4 transition hover:bg-white/[0.03] sm:px-6">
                        <span className="rounded-xl bg-white/5 p-2.5 text-slate-300"><Icon className="h-5 w-5" /></span>
                        <div className="min-w-0">
                          <p className="font-bold">{categoryLabels[activity.category]}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {activity.occurredAt.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {activity.distance ? ` · ${formatDistance(activity.distance)}${activity.category === 'SWIM' ? 'm' : 'km'}` : ''}
                            {activity.duration ? ` · ${formatDuration(activity.duration)}` : ''}
                            {activity.pace ? ` · ${formatPace(activity.pace)}/km` : ''}
                          </p>
                          {activity.completedWithFriend && <p className="mt-1 text-xs text-sky-300">With {activity.companion || 'a friend'}</p>}
                        </div>
                        <div className="text-right">
                          <p className="font-black text-orange-300">+{activity.points.toFixed(1)}</p>
                          {(activity.stravaActivityId || activity.proofUrl) && (
                            <a
                              href={activity.stravaActivityId ? `https://www.strava.com/activities/${activity.stravaActivityId}` : activity.proofUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-white"
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <Empty message="No approved activities yet." />}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <SectionTitle icon={<Sparkles className="h-5 w-5 text-violet-300" />} title="Performance mix" subtitle="Points by activity" />
              <div className="mt-6 space-y-5">
                {profile.categories.map((category) => (
                  <div key={category.key}>
                    <div className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-300">{category.label}</span><span className="font-black">{category.points.toFixed(1)}</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full ${category.colour}`} style={{ width: `${profile.totalPoints ? Math.max(category.points ? 3 : 0, category.points / profile.totalPoints * 100) : 0}%` }} /></div>
                  </div>
                ))}
              </div>
              {profile.bestWeek && <div className="mt-6 rounded-xl bg-orange-400/10 p-4 text-sm"><span className="text-slate-400">Best week</span><p className="mt-1 font-black text-orange-300">Week {profile.bestWeek.weekNumber} · {profile.bestWeek.totalPoints.toFixed(1)} points</p></div>}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <SectionTitle icon={<Award className="h-5 w-5 text-yellow-300" />} title="Achievements" subtitle={`${unlockedAchievements} of ${profile.achievements.length} unlocked`} />
              <div className="mt-6 space-y-3">
                {profile.achievements.map((achievement) => (
                  <div key={achievement.name} className={`rounded-xl border p-4 ${achievement.unlocked ? 'border-yellow-400/20 bg-yellow-400/10' : 'border-white/5 bg-black/10'}`}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 rounded-lg p-2 ${achievement.unlocked ? 'bg-yellow-300 text-slate-950' : 'bg-white/5 text-slate-600'}`}>
                        {achievement.unlocked ? <Check className="h-4 w-4" /> : <Medal className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`font-bold ${achievement.unlocked ? 'text-yellow-100' : 'text-slate-400'}`}>{achievement.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{achievement.description}</p>
                        {!achievement.unlocked && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-slate-500" style={{ width: `${achievement.progress * 100}%` }} /></div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function HeroStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return <div className="flex items-start gap-3"><span className="rounded-xl bg-white/5 p-2.5">{icon}</span><div><h2 className="text-lg font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div></div>;
}

function Empty({ message }: { message: string }) {
  return <div className="p-10 text-center text-sm text-slate-500">{message}</div>;
}
