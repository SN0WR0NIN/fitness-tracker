'use client';
import PersonalAnalytics from '@/components/PersonalAnalytics';
import WeeklyProgressChart from '@/components/WeeklyProgressChart';
import ApprovedActivityDateEditor from '@/components/ApprovedActivityDateEditor';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import {
  Activity,
  Award,
  Bike,
  Camera,
  Check,
  Clock3,
  Download,
  ExternalLink,
  Flame,
  Footprints,
  Medal,
  Pencil,
  PartyPopper,
  Plus,
  Sparkles,
  Share2,
  Target,
  TrendingUp,
  Trash2,
  Users,
  Waves,
} from 'lucide-react';
import PendingActivityEditor from '@/components/PendingActivityEditor';
import Navbar from '@/components/Navbar';
import HeroAtmosphere from '@/components/HeroAtmosphere';
import ShareProfileButton from '@/components/ShareProfileButton';
import StravaIcon from '@/components/StravaIcon';
import { formatDistance, formatDuration, formatPace } from '@/lib/format';
import { usePwaInstall } from '@/components/PwaManager';

type ActivityCategory = 'RUN' | 'CYCLE' | 'SWIM' | 'WALK_OR_HIKE' | 'TROOP_GAMES';

type DashboardProfile = {
  id: string;
  name: string;
  bio: string;
  profilePhotoUrl: string | null;
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
  stravaEnabled: boolean;
  stravaConnected: boolean;
  email: string;
  hasCustomWeeklyGoal: boolean;
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
  proofUrl: string | null;
  occurredAt: string;
  stravaActivityId: string | null;
};

type SelectableUser = { id: string; name: string };

type Engagement = {
  weeklyGoal: number;
  currentWeekPoints: number;
  weeklyStreak: number;
  columnRank: number | null;
  columnCount: number;
  gapToNext: number;
  goalStatus: 'achieved' | 'on-track' | 'at-risk';
  daysRemaining: number;
  hoursRemaining: number;
  remainingPoints: number;
  goalCompletionStreak: number;
  milestone: 0 | 50 | 80 | 100;
  goalHistory: Array<{ weekNumber: number; dateRange: string; points: number; target: number; achieved: boolean; current: boolean }>;
};

type CommunityActivity = {
  id: string;
  category: ActivityCategory;
  distance: number;
  points: number;
  occurredAt: string;
  user: { id: string; name: string };
  column: { name: string };
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

export default function AthleteDashboard({
  profile,
  currentUser,
  activities,
  users,
  engagement,
  communityActivities,
}: {
  profile: DashboardProfile;
  currentUser: CurrentUser;
  activities: DashboardActivity[];
  users: SelectableUser[];
  engagement: Engagement;
  communityActivities: CommunityActivity[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canInstall, showIOSInstructions, install } = usePwaInstall();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [deleteMessage, setDeleteMessage] = useState('');
  const visibleActivities = activities.filter((activity) => !deletedIds.includes(activity.id));
  const deleteSubmission = async (activity: DashboardActivity) => {
    const warning = activity.status === 'APPROVED' ? ` This removes ${activity.points.toFixed(1)} points from your score and your Column's total.` : '';
    const syncWarning = activity.stravaActivityId ? ' This does not delete it from Strava; syncing again may reimport it.' : '';
    if (!window.confirm(`Delete this ${categoryLabels[activity.category]} submission?${warning}${syncWarning} This cannot be undone.`)) return;
    setDeletingId(activity.id);
    setDeleteMessage('');
    try {
      const response = await fetch(`/api/activities/${activity.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not delete submission.');
      setDeletedIds((ids) => [...ids, activity.id]);
      setDeleteMessage('Submission deleted. Your scores are being refreshed.');
      router.refresh();
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : 'Could not delete submission. Please try again.');
    } finally { setDeletingId(null); }
  };
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
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(profile.name);
  const [profileBio, setProfileBio] = useState(profile.bio);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(profile.profilePhotoUrl);
  const [weeklyGoal, setWeeklyGoal] = useState(engagement.weeklyGoal.toString());
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const activitySubmitted = searchParams.get('activitySubmitted') === 'true';

  const initials = profile.name.split(/\s+/).map((name) => name[0]).join('').slice(0, 2).toUpperCase();
  const approvedCount = activities.filter((activity) => activity.status === 'APPROVED').length;
  const pendingCount = activities.filter((activity) => activity.status === 'PENDING').length;
  const unlockedCount = profile.achievements.filter((achievement) => achievement.unlocked).length;
  const goalProgress = Math.min(100, engagement.currentWeekPoints / engagement.weeklyGoal * 100);
  const goalStatusLabel = engagement.goalStatus === 'achieved' ? 'Goal achieved' : engagement.goalStatus === 'on-track' ? 'On track' : 'At risk';
  const goalStatusStyle = engagement.goalStatus === 'achieved' ? 'bg-emerald-400/10 text-emerald-300' : engagement.goalStatus === 'on-track' ? 'bg-sky-400/10 text-sky-300' : 'bg-rose-400/10 text-rose-300';
  const latestUnlockedAchievement = [...profile.achievements].reverse().find((achievement) => achievement.unlocked);

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

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileMessage('');
    try {
      const response = await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName, weeklyGoal: Number(weeklyGoal), bio: profileBio, profilePhotoUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        setProfileMessage(data.error || 'Unable to update your profile.');
        return;
      }
      setEditingProfile(false);
      router.refresh();
    } catch (error) {
      console.error('Error saving profile:', error);
      setProfileMessage('Unable to update your profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const openProfileEditor = () => {
    setProfileName(profile.name);
    setProfileBio(profile.bio);
    setProfilePhotoUrl(profile.profilePhotoUrl);
    setWeeklyGoal(engagement.weeklyGoal.toString());
    setProfileMessage('');
    setEditingProfile(true);
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setProfileMessage('Choose a JPEG, PNG, or WebP image no larger than 2 MB.');
      return;
    }
    setUploadingPhoto(true);
    setProfileMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/profile/photo', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) {
        setProfileMessage(data.error || 'Unable to upload your photo.');
        return;
      }
      setProfilePhotoUrl(data.url);
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      setProfileMessage('Unable to upload your photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="hero-stage rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/20 sm:p-8">
          <HeroAtmosphere />
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="hero-reveal flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative h-20 w-20 shrink-0">
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-lime-300 via-yellow-300 to-orange-500 text-2xl font-black text-slate-950 shadow-xl shadow-orange-500/20">{profile.profilePhotoUrl ? <Image src={profile.profilePhotoUrl} alt={`${profile.name}'s profile photo`} fill sizes="80px" className="object-cover" /> : initials}</div>
                  <span className="absolute -right-1 -top-1 z-10 h-4 w-4 rounded-full border-4 border-slate-950 bg-lime-300" />
                </div>
                <div>
                  <p className="live-pulse inline-flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.2em] text-lime-300">My live season</p>
                  <h1 className="athletic-display mt-3 text-4xl leading-none sm:text-6xl">{profile.name}</h1>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-300"><Users className="h-4 w-4 text-sky-300" />{profile.column?.name ?? 'No column assigned'}</p>
                  {profile.bio ? <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">{profile.bio}</p> : null}
                </div>
              </div>
              <div className="hero-reveal hero-reveal-delay-2 mt-7 flex flex-wrap gap-3">
                <button type="button" onClick={openProfileEditor} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 hover:border-lime-300/30 hover:bg-lime-300/10"><Pencil className="h-4 w-4" />Edit profile</button>
                <Link href="/account" className="inline-flex items-center rounded-xl border border-white/10 px-5 py-2.5 text-sm font-bold">Email &amp; password</Link>
                <ShareProfileButton participantName={profile.name} profilePath={`/participants/${profile.id}`} />
                <Link href="/activities/new" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-400"><Plus className="h-4 w-4" />Log activity</Link>
              </div>
            </div>

            <div className="hero-reveal hero-reveal-delay-1 min-w-56 rounded-3xl border border-lime-300/20 bg-lime-300/[0.07] p-6 text-left backdrop-blur sm:text-right">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Season score</p>
              <p className="athletic-display mt-2 text-6xl leading-none text-lime-300 sm:text-7xl">{profile.totalPoints.toFixed(1)}</p>
              <p className="mt-2 text-sm font-bold text-slate-300">Rank {profile.rank ? `#${profile.rank}` : 'pending'} of {profile.participantCount}</p>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-lime-300 to-orange-400 transition-[width] duration-700" style={{ width: `${profile.rank ? Math.max(8, (profile.participantCount - profile.rank + 1) / Math.max(profile.participantCount, 1) * 100) : 8}%` }} /></div>
            </div>
          </div>

          <div className="hero-reveal hero-reveal-delay-3 mt-8 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 lg:grid-cols-4">
            <HeroStat label="Overall rank" value={profile.rank ? `#${profile.rank}` : '—'} detail={`of ${profile.participantCount} athletes`} />
            <HeroStat label="Weekly target" value={`${Math.round(goalProgress)}%`} detail={`${engagement.currentWeekPoints.toFixed(1)} of ${engagement.weeklyGoal.toFixed(0)} pts`} />
            <HeroStat label="Activities" value={approvedCount.toString()} detail={`${pendingCount} pending review`} />
            <HeroStat label="Achievements" value={unlockedCount.toString()} detail={`of ${profile.achievements.length} unlocked`} />
          </div>
        </section>

        {activitySubmitted ? (
          <section role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-100">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div><p className="font-black">Activity submitted</p><p className="mt-1 text-sm text-emerald-100/70">It is now in the review queue. Your points will count after an admin approves it.</p></div>
          </section>
        ) : null}

        {engagement.milestone === 100 ? (
          <section role="status" className="goal-celebration relative overflow-hidden rounded-2xl border border-lime-300/30 bg-gradient-to-r from-lime-300/15 via-yellow-300/10 to-orange-400/10 p-5 sm:p-6"><div className="relative flex items-start gap-4"><span className="rounded-2xl bg-lime-300 p-3 text-slate-950"><PartyPopper className="h-6 w-6" /></span><div><p className="text-xs font-black uppercase tracking-[0.18em] text-lime-300">Weekly goal complete</p><h2 className="mt-1 text-xl font-black">You hit {engagement.weeklyGoal.toFixed(0)} points. Brilliant work.</h2><p className="mt-1 text-sm text-slate-400">Every extra point now strengthens your personal and Column standing.</p></div></div></section>
        ) : engagement.milestone >= 80 ? (
          <section role="status" className="flex items-start gap-3 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4"><Target className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" /><div><p className="font-black text-orange-100">Final push — you&apos;re {Math.round(goalProgress)}% there</p><p className="mt-1 text-sm text-slate-400">Only {engagement.remainingPoints.toFixed(1)} points remain with {engagement.daysRemaining} {engagement.daysRemaining === 1 ? 'day' : 'days'} left.</p></div></section>
        ) : engagement.milestone >= 50 ? (
          <section role="status" className="flex items-start gap-3 rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" /><div><p className="font-black text-violet-100">Halfway milestone reached</p><p className="mt-1 text-sm text-slate-400">You&apos;ve crossed 50%. Another {engagement.remainingPoints.toFixed(1)} points completes this week&apos;s target.</p></div></section>
        ) : engagement.goalStatus === 'at-risk' && engagement.daysRemaining <= 2 ? (
          <section role="status" className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" /><div><p className="font-black text-rose-100">Your weekly target needs a final effort</p><p className="mt-1 text-sm text-slate-400">{engagement.remainingPoints.toFixed(1)} points remaining and about {engagement.hoursRemaining} hours left.</p></div></section>
        ) : null}

        {currentUser.stravaEnabled ? <section className="flex flex-col gap-4 rounded-2xl border border-orange-400/20 bg-gradient-to-r from-orange-500/10 to-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
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
        </section> : null}

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div className="flex items-center gap-5 rounded-2xl border border-orange-400/20 bg-gradient-to-br from-orange-400/10 to-white/[0.04] p-5 sm:p-6">
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full p-2" style={{ background: `conic-gradient(#f97316 ${goalProgress * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}>
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-slate-950"><span className="text-2xl font-black">{Math.round(goalProgress)}%</span><span className="text-[0.65rem] text-slate-500">complete</span></div>
            </div>
            <div><div className="flex flex-wrap items-center gap-2"><p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-orange-300"><Target className="h-4 w-4" />Weekly target</p><span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wider ${goalStatusStyle}`}>{goalStatusLabel}</span></div><p className="mt-3 text-3xl font-black">{engagement.currentWeekPoints.toFixed(1)} <span className="text-base text-slate-500">/ {engagement.weeklyGoal.toFixed(0)} pts</span></p><p className="mt-2 text-sm text-slate-400">{goalProgress >= 100 ? 'Goal complete — keep building the lead.' : `${engagement.remainingPoints.toFixed(1)} points to reach your ${currentUser.hasCustomWeeklyGoal ? 'chosen' : 'personalised'} target · ${engagement.daysRemaining}d left.`}</p><button type="button" onClick={openProfileEditor} className="mt-3 text-xs font-black text-orange-300 hover:text-orange-200">Change target</button></div>
          </div>
          <EngagementCard icon={<Flame className="h-6 w-6" />} tone="text-orange-300 bg-orange-400/10" label="Goal streak" value={`${engagement.goalCompletionStreak} ${engagement.goalCompletionStreak === 1 ? 'week' : 'weeks'}`} detail={engagement.goalCompletionStreak ? 'Consecutive weekly targets completed.' : `${engagement.weeklyStreak} active-week streak · complete this target to begin.`} />
          <EngagementCard icon={<TrendingUp className="h-6 w-6" />} tone="text-sky-300 bg-sky-400/10" label="Column momentum" value={engagement.columnRank ? `#${engagement.columnRank} of ${engagement.columnCount}` : 'Not ranked'} detail={engagement.columnRank === 1 ? 'Your column leads the challenge.' : engagement.columnRank ? `${engagement.gapToNext.toFixed(1)} points to the next place.` : 'Earn points to enter the standings.'} />
        </section>

        <WeeklyProgressChart weeks={engagement.goalHistory} />

        <PersonalAnalytics activities={activities} today={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })} />

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <SectionTitle icon={<Award className="h-5 w-5 text-yellow-300" />} title="Achievements" subtitle={`${unlockedCount} unlocked · keep moving for the rest`} />
          {latestUnlockedAchievement ? <div className="mt-5 flex items-start gap-3 rounded-2xl border border-yellow-300/20 bg-gradient-to-r from-yellow-300/10 to-orange-400/5 p-4"><span className="rounded-xl bg-yellow-300 p-2.5 text-slate-950"><PartyPopper className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-wider text-yellow-300">Latest badge unlocked</p><p className="mt-1 font-black text-yellow-100">{latestUnlockedAchievement.name}</p><p className="mt-1 text-sm text-slate-400">{latestUnlockedAchievement.description}</p></div></div> : null}
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

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <SectionTitle icon={<Clock3 className="h-5 w-5 text-emerald-300" />} title="Live activity feed" subtitle="Recently approved efforts from across Kilo Golf" />
          {communityActivities.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{communityActivities.map((activity) => {
            const Icon = categoryIcons[activity.category];
            return <Link key={activity.id} href={`/participants/${activity.user.id}`} className="group rounded-xl border border-white/5 bg-black/10 p-4 transition hover:border-emerald-400/20 hover:bg-emerald-400/5"><div className="flex items-start justify-between gap-3"><span className="rounded-xl bg-emerald-400/10 p-2 text-emerald-300"><Icon className="h-5 w-5" /></span><span className="font-black text-emerald-300">+{activity.points.toFixed(1)}</span></div><p className="mt-4 font-black transition group-hover:text-emerald-200">{activity.user.name}</p><p className="mt-1 text-xs text-slate-500">{activity.column.name} · {categoryLabels[activity.category]}{activity.distance ? ` · ${formatDistance(activity.distance)}${activity.category === 'SWIM' ? 'm' : 'km'}` : ''}</p><p className="mt-2 text-[0.65rem] text-slate-600">{new Date(activity.occurredAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</p></Link>;
          })}</div> : <Empty message="Approved activities from the team will appear here." />}
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <div className="flex flex-wrap items-end justify-between gap-3 p-5 sm:p-6">
            <SectionTitle icon={<Activity className="h-5 w-5 text-emerald-300" />} title="My activities" subtitle="Track approvals and manage your submissions" />
            <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-400">{visibleActivities.length} total</span>
          </div>
          <p role="status" aria-live="polite" className="px-5 text-sm text-slate-300 sm:px-6">{deleteMessage}</p>
          {visibleActivities.length ? (
            <div>
              {visibleActivities.map((activity) => {
                const Icon = categoryIcons[activity.category];
                return (
                  <div id={`activity-${activity.id}`} key={activity.id} className="grid scroll-mt-24 gap-4 border-t border-white/5 px-5 py-4 sm:px-6 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center">
                    <span className="hidden rounded-xl bg-white/5 p-2.5 text-slate-300 lg:block"><Icon className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{categoryLabels[activity.category]}</p><Status status={activity.status} /></div>
                      <p className="mt-1 text-xs text-slate-500">{new Date(activity.occurredAt).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric' })}{activity.distance ? ` · ${formatDistance(activity.distance)}${activity.category === 'SWIM' ? 'm' : 'km'}` : ''}{activity.duration ? ` · ${formatDuration(activity.duration)}` : ''}{activity.pace ? ` · ${formatPace(activity.pace)}/km` : ''}</p>
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
                      <button type="button" disabled={deletingId !== null} onClick={() => void deleteSubmission(activity)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-rose-300 hover:bg-rose-400/10 disabled:opacity-50" aria-label={`Delete ${categoryLabels[activity.category]} submission from ${new Date(activity.occurredAt).toLocaleDateString('en-SG')}`}><Trash2 className="h-4 w-4" />{deletingId === activity.id ? 'Deleting…' : 'Delete'}</button>
                      <span className="min-w-16 text-right font-black text-orange-300">+{activity.points.toFixed(1)}</span>
                    </div>
                    {activity.status === 'APPROVED' ? <ApprovedActivityDateEditor activity={activity} /> : null}
                    {activity.status === 'PENDING' ? <PendingActivityEditor activity={activity} users={users.filter((user) => user.id !== profile.id)} /> : null}
                  </div>
                );
              })}
            </div>
          ) : <Empty message="No activities yet. Log your first activity to begin." />}
        </section>

        {editingProfile ? (
          <div role="dialog" aria-modal="true" aria-labelledby="profile-settings-title" className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/85 backdrop-blur-sm sm:items-center sm:p-4">
            <section className="flex max-h-[calc(100dvh-0.75rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/5 px-5 py-5 sm:px-8 sm:py-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-lime-300">Personal settings</p><h2 id="profile-settings-title" className="mt-2 text-2xl font-black">Edit your profile</h2><p className="mt-2 text-sm text-slate-400">Your name appears across rankings, activities, and Column pages.</p></div><button type="button" onClick={() => setEditingProfile(false)} aria-label="Close profile settings" className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-slate-400 hover:text-white">Close</button></div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-8">
                <div className="mt-6 space-y-5">
                <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-black/15 p-4">
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-lime-300 to-orange-400 text-xl font-black text-slate-950">{profilePhotoUrl ? <Image src={profilePhotoUrl} alt="Profile photo preview" fill sizes="80px" className="object-cover" /> : initials}</div>
                  <div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold transition hover:border-lime-300/30"><Camera className="h-4 w-4" />{uploadingPhoto ? 'Uploading…' : profilePhotoUrl ? 'Replace photo' : 'Add photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingPhoto} onChange={(event) => void uploadPhoto(event.target.files?.[0])} className="sr-only" /></label><p className="mt-2 text-xs text-slate-500">Square images work best · maximum 2 MB</p>{profilePhotoUrl ? <button type="button" onClick={() => setProfilePhotoUrl(null)} className="mt-2 text-xs font-bold text-rose-300">Remove photo</button> : null}</div>
                </div>
                <label className="block"><span className="text-sm font-bold text-slate-300">Display name</span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} minLength={2} maxLength={60} autoComplete="name" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none transition focus:border-lime-300" /></label>
                <label className="block"><span className="text-sm font-bold text-slate-300">Athlete bio</span><textarea value={profileBio} onChange={(event) => setProfileBio(event.target.value)} maxLength={160} rows={3} placeholder="Example: Weekend runner chasing consistency and points for the team." className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-violet-300" /><span className="mt-1 block text-right text-xs text-slate-500">{profileBio.length}/160</span></label>
                <label className="block"><span className="text-sm font-bold text-slate-300">Weekly points target</span><input type="number" min="5" max="500" step="5" value={weeklyGoal} onChange={(event) => setWeeklyGoal(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none transition focus:border-orange-400" /><span className="mt-2 block text-xs text-slate-500">Choose between 5 and 500 points. You can change it whenever your training plan changes.</span></label>
                <div className="grid gap-3 rounded-2xl border border-white/5 bg-black/15 p-4 text-sm sm:grid-cols-2"><div><span className="block text-xs text-slate-500">Login email</span><span className="mt-1 block truncate font-bold text-slate-300">{currentUser.email}</span></div><div><span className="block text-xs text-slate-500">Assigned Column</span><span className="mt-1 block font-bold text-slate-300">{profile.column?.name ?? 'Not assigned'}</span></div></div>
                {canInstall || showIOSInstructions ? <div className="flex items-start gap-3 rounded-2xl border border-sky-300/20 bg-sky-400/[0.07] p-4"><span className="rounded-xl bg-sky-400/10 p-2.5 text-sky-300">{showIOSInstructions && !canInstall ? <Share2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="font-black text-sky-100">Install KG Active</p><p className="mt-1 text-xs leading-5 text-slate-400">{showIOSInstructions && !canInstall ? 'In Safari, tap Share and choose Add to Home Screen.' : 'Add the app to this device for quicker access and a full-screen experience.'}</p>{canInstall ? <button type="button" onClick={() => void install()} className="mt-3 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-black text-slate-950">Install app</button> : null}</div></div> : null}
                </div>
                {profileMessage ? <p role="alert" className="mt-4 text-sm font-semibold text-rose-300">{profileMessage}</p> : null}
              </div>
              <div className="flex shrink-0 justify-end gap-3 border-t border-white/10 bg-slate-900 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-8 sm:pb-6"><button type="button" onClick={() => setEditingProfile(false)} className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-bold text-slate-300">Cancel</button><button type="button" onClick={saveProfile} disabled={savingProfile || uploadingPhoto || profileName.trim().length < 2 || Number(weeklyGoal) < 5 || Number(weeklyGoal) > 500} className="rounded-xl bg-lime-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-lime-200 disabled:opacity-40">{savingProfile ? 'Saving…' : 'Save profile'}</button></div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function HeroStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

function EngagementCard({ icon, tone, label, value, detail }: { icon: React.ReactNode; tone: string; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><span className={`inline-flex rounded-xl p-2.5 ${tone}`}>{icon}</span><p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></div>;
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
