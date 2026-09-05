'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, ShieldCheck, TriangleAlert, XCircle } from 'lucide-react';
import ActivityProof from '@/components/ActivityProof';
import Navbar from '@/components/Navbar';
import { formatDistance, formatDuration, formatPace } from '@/lib/format';

type ActivityStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type DecisionStatus = 'DIFFERENT' | 'DUPLICATE' | 'LATER';
type Tab = 'OPEN' | 'LATER' | 'RESOLVED';

type ReviewActivity = {
  id: string;
  userId: string;
  columnId: string;
  category: 'RUN' | 'CYCLE' | 'SWIM' | 'WALK_OR_HIKE' | 'TROOP_GAMES';
  distance: number;
  pace: number | null;
  duration: number | null;
  elevationGain: number | null;
  points: number;
  completedWithFriend: boolean;
  companion: string | null;
  proofUrl: string | null;
  stravaActivityId: string | null;
  status: ActivityStatus;
  rejectionReason: string | null;
  occurredAt: string;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; name: string };
  column: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
};

type Decision = {
  pairKey: string;
  activityAId: string;
  activityBId: string;
  status: DecisionStatus;
  duplicateActivityId: string | null;
  keptActivityId: string | null;
  note: string | null;
  reviewedById: string | null;
  reviewedByName: string;
  reviewedAt: string;
  updatedAt: string;
};

type Pair = {
  pairKey: string;
  reason: string;
  activityA: ReviewActivity;
  activityB: ReviewActivity;
  decision: Decision | null;
};

type CentreData = { open: Pair[]; later: Pair[]; resolved: Pair[] };

const categoryLabel: Record<ReviewActivity['category'], string> = {
  RUN: 'Run',
  CYCLE: 'Cycle',
  SWIM: 'Swim',
  WALK_OR_HIKE: 'Walk / Hike',
  TROOP_GAMES: 'Troop Games',
};

export default function DuplicateReviewCentre({ data }: { data: CentreData }) {
  const [tab, setTab] = useState<Tab>('OPEN');
  const pairs = tab === 'OPEN' ? data.open : tab === 'LATER' ? data.later : data.resolved;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" />Back to Command Centre</Link>

        <header className="mt-3 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_48%),rgba(255,255,255,0.04)] p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-300"><ShieldCheck className="h-4 w-4" />Integrity review</p>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">Duplicate Review Centre</h1>
              <p className="mt-3 max-w-3xl text-slate-400">Compare both entries before changing points. Different workouts are permanently cleared from duplicate warnings; deferred pairs remain tracked; confirmed duplicates are rejected with score reversal in the same database transaction.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <CountCard label="Open" value={data.open.length} tone="text-amber-300" />
              <CountCard label="Later" value={data.later.length} tone="text-sky-300" />
              <CountCard label="Resolved" value={data.resolved.length} tone="text-emerald-300" />
            </div>
          </div>
        </header>

        <section className="mt-6 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] p-2">
          <TabButton active={tab === 'OPEN'} onClick={() => setTab('OPEN')} icon={<TriangleAlert className="h-4 w-4" />} label="Open warnings" count={data.open.length} />
          <TabButton active={tab === 'LATER'} onClick={() => setTab('LATER')} icon={<Clock3 className="h-4 w-4" />} label="Review later" count={data.later.length} />
          <TabButton active={tab === 'RESOLVED'} onClick={() => setTab('RESOLVED')} icon={<CheckCircle2 className="h-4 w-4" />} label="Resolved" count={data.resolved.length} />
        </section>

        <section className="mt-5 space-y-5">
          {pairs.length ? pairs.map((pair) => <PairCard key={pair.pairKey} pair={pair} resolved={tab === 'RESOLVED'} />) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-16 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
              <h2 className="mt-4 text-xl font-black">Nothing here</h2>
              <p className="mt-2 text-sm text-slate-500">{tab === 'OPEN' ? 'All current duplicate warnings have been reviewed.' : tab === 'LATER' ? 'No pairs are deferred for later review.' : 'No duplicate decisions have been recorded yet.'}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function PairCard({ pair, resolved }: { pair: Pair; resolved: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState(pair.decision?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const act = async (action: 'DIFFERENT' | 'LATER' | 'DUPLICATE', duplicateActivityId?: string) => {
    if (action === 'DIFFERENT' && note.trim().length < 5) {
      setError('Add a short note explaining why these are different workouts.');
      return;
    }
    if (action === 'DUPLICATE') {
      const duplicate = duplicateActivityId === pair.activityA.id ? 'Entry A' : 'Entry B';
      const kept = duplicateActivityId === pair.activityA.id ? 'Entry B' : 'Entry A';
      if (!window.confirm(`Mark ${duplicate} as the duplicate and keep ${kept}? If the duplicate is approved, its points will be reversed immediately.`)) return;
    }

    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/duplicates/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          activityAId: pair.activityA.id,
          activityBId: pair.activityB.id,
          duplicateActivityId,
          note: note.trim() || undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Could not save the duplicate decision.');
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not save the duplicate decision.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/participants/${pair.activityA.user.id}`} className="font-black transition hover:text-orange-300">{pair.activityA.user.name}</Link>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-400">{pair.activityA.column.name}</span>
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm font-bold text-amber-200"><TriangleAlert className="h-4 w-4" />{pair.reason}</p>
        </div>
        {pair.decision ? <DecisionBadge decision={pair.decision} /> : <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-amber-200">Needs review</span>}
      </div>

      <div className="grid gap-px bg-white/10 lg:grid-cols-2">
        <ActivitySide label="Entry A" activity={pair.activityA} decision={pair.decision} />
        <ActivitySide label="Entry B" activity={pair.activityB} decision={pair.decision} />
      </div>

      {resolved ? (
        pair.decision ? <div className="border-t border-white/10 bg-slate-950/40 p-5">
          <p className="text-sm font-bold text-slate-200">Decision by {pair.decision.reviewedByName} · {formatSg(pair.decision.reviewedAt)}</p>
          <p className="mt-1 text-sm text-slate-500">{pair.decision.status === 'DIFFERENT' ? 'Confirmed as separate workouts.' : pair.decision.status === 'DUPLICATE' ? 'One entry was confirmed duplicate and rejected.' : 'Deferred for later review.'}</p>
          {pair.decision.note ? <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">{pair.decision.note}</p> : null}
        </div> : null
      ) : (
        <div className="border-t border-white/10 p-5">
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Review note</label>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} placeholder="Why are these different, or any note for later review?" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-orange-400" />
          {error ? <p role="alert" className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p> : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <button type="button" disabled={busy} onClick={() => act('DIFFERENT')} className="min-h-12 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 text-sm font-black text-emerald-200 transition hover:bg-emerald-400/15 disabled:opacity-50"><CheckCircle2 className="mr-2 inline h-4 w-4" />Different workouts</button>
            <button type="button" disabled={busy} onClick={() => act('LATER')} className="min-h-12 rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 text-sm font-black text-sky-200 transition hover:bg-sky-400/15 disabled:opacity-50"><Clock3 className="mr-2 inline h-4 w-4" />Review later</button>
            <button type="button" disabled={busy} onClick={() => act('DUPLICATE', pair.activityA.id)} className="min-h-12 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 text-sm font-black text-rose-200 transition hover:bg-rose-400/15 disabled:opacity-50"><XCircle className="mr-2 inline h-4 w-4" />Mark Entry A duplicate</button>
            <button type="button" disabled={busy} onClick={() => act('DUPLICATE', pair.activityB.id)} className="min-h-12 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 text-sm font-black text-rose-200 transition hover:bg-rose-400/15 disabled:opacity-50"><XCircle className="mr-2 inline h-4 w-4" />Mark Entry B duplicate</button>
          </div>
          <p className="mt-3 text-xs text-slate-600">Marking a duplicate never deletes the record. It changes that entry to Rejected, records the duplicate relationship, and reverses awarded points if necessary.</p>
        </div>
      )}
    </article>
  );
}

function ActivitySide({ label, activity, decision }: { label: string; activity: ReviewActivity; decision: Decision | null }) {
  const duplicate = decision?.status === 'DUPLICATE' && decision.duplicateActivityId === activity.id;
  const kept = decision?.status === 'DUPLICATE' && decision.keptActivityId === activity.id;
  return (
    <section className="bg-slate-950/70 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
            {duplicate ? <span className="rounded-full bg-rose-400/10 px-2 py-1 text-[0.65rem] font-black uppercase text-rose-300">Duplicate</span> : null}
            {kept ? <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[0.65rem] font-black uppercase text-emerald-300">Kept</span> : null}
          </div>
          <p className="mt-2 text-lg font-black">{categoryLabel[activity.category]}</p>
          <p className="mt-1 text-sm text-slate-400">{formatSg(activity.occurredAt)}</p>
        </div>
        <div className="text-right"><p className="text-2xl font-black text-orange-300">{activity.points.toFixed(1)}</p><p className="text-[0.65rem] uppercase tracking-wider text-slate-600">points</p></div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Detail label="Status" value={activity.status.charAt(0) + activity.status.slice(1).toLowerCase()} />
        <Detail label="Distance" value={activity.distance ? `${formatDistance(activity.distance)}${activity.category === 'SWIM' ? 'm' : 'km'}` : 'Not required'} />
        <Detail label="Pace" value={activity.pace ? `${formatPace(activity.pace)}/km` : '—'} />
        <Detail label="Duration" value={activity.duration ? formatDuration(activity.duration) : '—'} />
        <Detail label="Elevation" value={activity.elevationGain ? `${Math.round(activity.elevationGain)}m` : '—'} />
        <Detail label="Companion" value={activity.completedWithFriend ? activity.companion || 'Recorded friend' : 'Solo'} />
      </div>

      <div className="mt-5">
        <ActivityProof proofUrl={activity.proofUrl} label={`${label} proof for ${activity.user.name}`} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        {activity.stravaActivityId ? <a href={`https://www.strava.com/activities/${activity.stravaActivityId}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-bold text-orange-300 hover:underline"><ExternalLink className="h-3.5 w-3.5" />Open Strava</a> : <span className="text-slate-600">No Strava link</span>}
        <span className="text-slate-700">ID {activity.id}</span>
      </div>
      {activity.rejectionReason ? <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-200">{activity.rejectionReason}</p> : null}
    </section>
  );
}

function DecisionBadge({ decision }: { decision: Decision }) {
  const label = decision.status === 'DIFFERENT' ? 'Different workouts' : decision.status === 'DUPLICATE' ? 'Duplicate resolved' : 'Review later';
  const classes = decision.status === 'DIFFERENT' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : decision.status === 'DUPLICATE' ? 'border-rose-400/20 bg-rose-400/10 text-rose-200' : 'border-sky-400/20 bg-sky-400/10 text-sky-200';
  return <span className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider ${classes}`}>{label}</span>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3"><p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-600">{label}</p><p className="mt-1 break-words font-bold text-slate-300">{value}</p></div>;
}

function CountCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="min-w-20 rounded-xl border border-white/10 bg-black/20 px-3 py-3"><p className={`text-2xl font-black ${tone}`}>{value}</p><p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-600">{label}</p></div>;
}

function TabButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return <button type="button" onClick={onClick} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-black transition ${active ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{icon}{label}<span className="rounded-full bg-black/20 px-2 py-0.5 text-xs">{count}</span></button>;
}

function formatSg(value: string) {
  return new Date(value).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
