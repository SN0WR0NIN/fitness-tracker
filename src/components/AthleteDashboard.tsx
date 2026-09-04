'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import {
  Activity,
  Award,
  Bike,
  Check,
  ExternalLink,
  Footprints,
  Medal,
  Plus,
  Sparkles,
  Trophy,
  Users,
  Waves,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import ShareProfileButton from '@/components/ShareProfileButton';
import StravaIcon from '@/components/StravaIcon';
import { formatDistance, formatDuration, formatPace } from '@/lib/format';

type ActivityCategory = 'RUN' | 'CYCLE' | 'SWIM' | 'WALK_OR_HIKE' | 'TROOP_GAMES';

type DashboardProfile = {
  id: string;
  name: string;
  column: { id: string; name: string } | null;
  totalPoints: number;
  rank: number | null;
  participantCount: number;
  weeklyScores: Array<{ weekNumber: number; totalPoints: number }>;
  categories: Array<{ key: ActivityCategory; label: string; colour: string; points: number }>;
  achievements: Array<{ name: string; description: string; unlocked: boolean; progress: number }>;
  bestWeek: { weekNumber: number; totalPoints: number } | null;
};

type CurrentUser = {
  stravaConnected: boolean;
};

type DashboardActivity = {
  id: string;
  category: ActivityCategory;
  distance: number;
  pace: number | null;
  duration: number | null;
  points: number;
  completedWithFriend: boolean;
  companion: string | null;
  companionUserId: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  occurredAt: string;
  stravaActivityId: string | null;
};

type SelectableUser = { id: string; name: string };

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

export default function AthleteDashboard({
  profile,
  currentUser,
  activities,
  users,
}: {
  profile: DashboardProfile;
  currentUser: CurrentUser;
  activities: DashboardActivity[];
  users: SelectableUser[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(() => {
    if (searchParams.get('stravaConnected') === 'true') {
      return 'Strava connected. Sync now to import your latest workouts.';
    }
    const stravaError = searchParams.get('stravaError');
    return stravaError ? `Strava connection failed: ${stravaError}` : '';
  });
  const [editingCompanionId, setEditingCompanionId] = useState<string | null>(null);
  const [companionSelect, setCompanionSelect] = useState('');
  const [savingCompanion, setSavingCompanion] = useState(false);
  const activitySubmitted = searchParams.get('activitySubmitted') === 'true';

  const initials = profile.name.split(/\s+/).map((name) => name[0]).join('').slice(0, 2).toUpperCase();
  const approvedCount = activities.filter((activity) => activity.status === 'APPROVED').length;
  const pendingCount = activities.filter((activity) => activity.status === 'PENDING').length;
  const unlockedCount = profile.achievements.filter((achievement) => achievement.unlocked).length;
  const maxWeekPoints = Math.max(...profile.weeklyScores.map((week) => week.totalPoints), 1);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const response = await fetch('/api/strava/sync', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setSyncMessage(`Imported ${data.imported} new activities · ${data.skipped} already synced.`);
        router.refresh();
      } else {
        setSyncMessage(data.error || 'Failed to sync Strava activities.');
      }
    } catch (error) {
      console.error('Error syncing Strava:', error);
      setSyncMessage('Failed to sync Strava activities.');
    } finally {
      setSyncing(false);
    }
  };

  const startEditCompanion = (activity: DashboardActivity) => {
    setEditingCompanionId(activity.id);
    setCompanionSelect(activity.companionUserId ?? '');
  };

  const saveCompanion = async (activityId: string) => {
    setSavingCompanion(true);
    try {
      const response = await fetch(`/api/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionUserId: companionSelect || null }),
      });
      if (response.ok) {
        setEditingCompanionId(null);
        router.refresh();
      }
    } finally {
      setSavingCompanion(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.2),_transparent_40%),radial-gradient(circle_at_85%_15%,_rgba(37,99,235,0.24),_transparent_34%)]" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 text-2xl font-black shadow-xl shadow-orange-500/20">{initials}</div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-300">My athlete hub</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{profile.name}</h1>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-300"><Users className="h-4 w-4 text-sky-300" />{profile.column?.name ?? 'No column assigned'}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <ShareProfileButton participantName={profile.name} profilePath={`/participants/${profile.id}`} />
                <Link href="/activities/new" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold shadow-lg shadow-orange-500/20 transition hover:bg-orange-400"><Plus className="h-4 w-4" />Log activity</Link>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <HeroStat label="Overall rank" value={profile.rank ? `#${profile.rank}` : '—'} detail={`of ${profile.participantCount} athletes`} />
              <HeroStat label="Total points" value={profile.totalPoints.toFixed(1)} detail="approved score" />
              <HeroStat label="Activities" value={approvedCount.toString()} detail={`${pendingCount} pending review`} />
              <HeroStat label="Achievements" value={unlockedCount.toString()} detail={`of ${profile.achievements.length} unlocked`} />
            </div>
          </div>
        </section>

        {activitySubmitted ? (
          <section role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-100">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div><p className="font-black">Activity submitted</p><p className="mt-1 text-sm text-emerald-100/70">It is now in the review queue. Your points will count after an admin approves it.</p></div>
          </section>
        ) : null}

        <section className="flex flex-col gap-4 rounded-2xl border border-orange-400/20 bg-gradient-to-r from-orange-500/10 to-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span className="rounded-2xl bg-orange-500/15 p-3 text-orange-400"><StravaIcon className="h-7 w-7" /></span>
            <div><h2 className="font-black">Strava connection</h2><p className="mt-1 text-sm text-slate-400">{syncMessage || (currentUser.stravaConnected ? 'Connected and ready to import your activities.' : 'Connect once, then import workouts in seconds.')}</p></div>
          </div>
          {currentUser.stravaConnected ? (
            <button type="button" onClick={handleSync} disabled={syncing} className="shrink-0 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold transition hover:bg-orange-400 disabled:opacity-50">{syncing ? 'Syncing…' : 'Sync activities'}</button>
          ) : (
            // This route intentionally performs a full-page redirect to Strava OAuth.
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a href="/api/auth/strava" className="shrink-0 rounded-xl bg-orange-500 px-5 py-2.5 text-center text-sm font-bold transition hover:bg-orange-400">Connect Strava</a>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <SectionTitle icon={<Trophy className="h-5 w-5 text-yellow-300" />} title="Weekly progress" subtitle="Your approved points by week" />
            {profile.weeklyScores.length ? (
              <div className="mt-8 flex h-56 items-end gap-3 overflow-x-auto border-b border-white/10 px-2 pb-1">
                {profile.weeklyScores.map((week) => (
                  <div key={week.weekNumber} className="flex h-full min-w-14 flex-1 flex-col justify-end text-center">
                    <span className="mb-2 text-xs font-bold text-orange-300">{week.totalPoints.toFixed(1)}</span>
                    <div className="mx-auto w-full max-w-16 rounded-t-lg bg-gradient-to-t from-orange-600 to-yellow-300" style={{ height: `${Math.max(8, week.totalPoints / maxWeekPoints * 78)}%` }} />
                    <span className="mt-2 text-xs text-slate-500">W{week.weekNumber}</span>
                  </div>
                ))}
              </div>
            ) : <Empty message="Your weekly progress will appear after an activity is approved." />}
            {profile.bestWeek ? <div className="mt-5 rounded-xl bg-orange-400/10 p-4 text-sm text-orange-200">Personal best: <strong>Week {profile.bestWeek.weekNumber} · {profile.bestWeek.totalPoints.toFixed(1)} points</strong></div> : null}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <SectionTitle icon={<Sparkles className="h-5 w-5 text-violet-300" />} title="Performance mix" subtitle="Where your points come from" />
            <div className="mt-6 space-y-5">
              {profile.categories.map((category) => (
                <div key={category.key}>
                  <div className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-300">{category.label}</span><span className="font-black">{category.points.toFixed(1)}</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full ${category.colour}`} style={{ width: `${profile.totalPoints ? Math.max(category.points ? 3 : 0, category.points / profile.totalPoints * 100) : 0}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <SectionTitle icon={<Award className="h-5 w-5 text-yellow-300" />} title="Achievements" subtitle={`${unlockedCount} unlocked · keep moving for the rest`} />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profile.achievements.map((achievement) => (
              <div key={achievement.name} className={`rounded-xl border p-4 ${achievement.unlocked ? 'border-yellow-400/20 bg-yellow-400/10' : 'border-white/5 bg-black/10'}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 rounded-lg p-2 ${achievement.unlocked ? 'bg-yellow-300 text-slate-950' : 'bg-white/5 text-slate-600'}`}>{achievement.unlocked ? <Check className="h-4 w-4" /> : <Medal className="h-4 w-4" />}</span>
                  <div className="min-w-0 flex-1"><p className={`font-bold ${achievement.unlocked ? 'text-yellow-100' : 'text-slate-400'}`}>{achievement.name}</p><p className="mt-1 text-xs text-slate-500">{achievement.description}</p>{achievement.unlocked ? null : <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-slate-500" style={{ width: `${achievement.progress * 100}%` }} /></div>}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <div className="flex flex-wrap items-end justify-between gap-3 p-5 sm:p-6">
            <SectionTitle icon={<Activity className="h-5 w-5 text-emerald-300" />} title="My activities" subtitle="Track approvals and manage synced workouts" />
            <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-400">{activities.length} total</span>
          </div>
          {activities.length ? (
            <div>
              {activities.map((activity) => {
                const Icon = categoryIcons[activity.category];
                return (
                  <div key={activity.id} className="grid gap-4 border-t border-white/5 px-5 py-4 sm:px-6 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center">
                    <span className="hidden rounded-xl bg-white/5 p-2.5 text-slate-300 lg:block"><Icon className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{categoryLabels[activity.category]}</p><Status status={activity.status} /></div>
                      <p className="mt-1 text-xs text-slate-500">{new Date(activity.occurredAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}{activity.distance ? ` · ${formatDistance(activity.distance)}${activity.category === 'SWIM' ? 'm' : 'km'}` : ''}{activity.duration ? ` · ${formatDuration(activity.duration)}` : ''}{activity.pace ? ` · ${formatPace(activity.pace)}/km` : ''}</p>
                      {activity.rejectionReason ? <p className="mt-2 text-xs text-rose-300">Reason: {activity.rejectionReason}</p> : null}
                    </div>
                    <div className="text-sm text-slate-400">
                      {editingCompanionId === activity.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select aria-label="Select activity companion" value={companionSelect} onChange={(event) => setCompanionSelect(event.target.value)} className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-white"><option value="">No friend</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
                          <button type="button" onClick={() => saveCompanion(activity.id)} disabled={savingCompanion} className="text-xs font-bold text-sky-300 disabled:opacity-50">Save</button>
                          <button type="button" onClick={() => setEditingCompanionId(null)} className="text-xs text-slate-500">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2"><span>{activity.completedWithFriend ? `With ${activity.companion || 'a friend'}` : 'Solo activity'}</span>{activity.status === 'PENDING' && activity.stravaActivityId ? <button type="button" onClick={() => startEditCompanion(activity)} className="text-xs font-bold text-sky-300">Edit</button> : null}</div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-5 lg:justify-end">
                      {activity.stravaActivityId ? <a href={`https://www.strava.com/activities/${activity.stravaActivityId}`} target="_blank" rel="noopener noreferrer" aria-label="View activity on Strava" className="text-orange-400 transition hover:text-orange-300"><ExternalLink className="h-4 w-4" /></a> : <span />}
                      <span className="min-w-16 text-right font-black text-orange-300">+{activity.points.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <Empty message="No activities yet. Log your first activity to begin." />}
        </section>
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

function Status({ status }: { status: DashboardActivity['status'] }) {
  const styles = status === 'APPROVED' ? 'bg-emerald-400/10 text-emerald-300' : status === 'REJECTED' ? 'bg-rose-400/10 text-rose-300' : 'bg-yellow-400/10 text-yellow-300';
  return <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black tracking-wide ${styles}`}>{status}</span>;
}

function Empty({ message }: { message: string }) {
  return <div className="p-10 text-center text-sm text-slate-500">{message}</div>;
}
