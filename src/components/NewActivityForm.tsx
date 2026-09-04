'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ImagePlus, Info, Sparkles, Upload, Users, X } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { calculateActivityPoints, resolveEffectiveCategory, type ActivityCategory, type ScoringRules } from '@/lib/scoring';

type SelectableUser = { id: string; name: string };

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ACTIVITY_CATEGORIES: Array<{ value: ActivityCategory; label: string; icon: string }> = [
  { value: 'RUN', label: 'Run', icon: '🏃' },
  { value: 'CYCLE', label: 'Cycle', icon: '🚴' },
  { value: 'SWIM', label: 'Swim', icon: '🏊' },
  { value: 'WALK_OR_HIKE', label: 'Walk / Hike', icon: '🥾' },
  { value: 'TROOP_GAMES', label: 'Troop Games', icon: '🎯' },
];

function scoringDescription(category: ActivityCategory, rules: ScoringRules) {
  if (category === 'RUN') return `${rules.runBasePerKm} point/km plus pace bonus`;
  if (category === 'CYCLE') return `1 point for every ${rules.cycleKmPerPoint}km`;
  if (category === 'SWIM') return `1 point for every ${rules.swimMetersPerPoint}m`;
  if (category === 'WALK_OR_HIKE') return `${rules.walkPointsPerKm} point/km · minimum ${rules.walkMinimumKm}km`;
  return `${rules.troopGamePoints} points per session`;
}

function parsePace(value: string): number | undefined {
  if (!value.trim()) return undefined;
  if (value.includes(':')) {
    const [minutesText, secondsText] = value.split(':');
    const minutes = Number(minutesText);
    const seconds = Number(secondsText);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds < 0 || seconds >= 60) return undefined;
    return minutes + seconds / 60;
  }
  const decimalPace = Number(value);
  return Number.isFinite(decimalPace) ? decimalPace : undefined;
}

export default function NewActivityForm({ users, scoringRules }: { users: SelectableUser[]; scoringRules: ScoringRules }) {
  const router = useRouter();
  const [category, setCategory] = useState<ActivityCategory>('RUN');
  const [distance, setDistance] = useState('');
  const [pace, setPace] = useState('');
  const [withFriend, setWithFriend] = useState(false);
  const [companionUserId, setCompanionUserId] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const distanceNumber = distance ? Number(distance) : undefined;
  const paceNumber = parsePace(pace);
  const effectiveCategory = resolveEffectiveCategory(category, paceNumber, scoringRules);
  const preview = useMemo(() => calculateActivityPoints({
    category: effectiveCategory,
    distance: distanceNumber,
    pace: paceNumber,
    completedWithFriend: withFriend && Boolean(companionUserId),
  }, scoringRules), [effectiveCategory, distanceNumber, paceNumber, withFriend, companionUserId, scoringRules]);

  const validationMessage = useMemo(() => {
    if (category !== 'TROOP_GAMES' && (!distanceNumber || distanceNumber <= 0)) return 'Enter a distance greater than zero.';
    if (category === 'WALK_OR_HIKE' && distanceNumber && distanceNumber < scoringRules.walkMinimumKm) return `Walks under ${scoringRules.walkMinimumKm}km do not earn points.`;
    if (category === 'RUN' && pace && (paceNumber === undefined || paceNumber <= 0)) return 'Use a positive pace such as 6:30 or 6.5.';
    if (withFriend && !companionUserId) return 'Select the registered friend who joined you.';
    return '';
  }, [category, distanceNumber, pace, paceNumber, withFriend, companionUserId, scoringRules.walkMinimumKm]);

  const chooseCategory = (nextCategory: ActivityCategory) => {
    setCategory(nextCategory);
    if (nextCategory !== 'RUN') setPace('');
    if (nextCategory === 'TROOP_GAMES') setDistance('');
    setSubmitError('');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError('');
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('The image is larger than 4MB. Please choose a smaller screenshot.');
      event.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to upload proof.');
      setProofUrl(data.url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload proof.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError('');
    if (validationMessage) {
      setSubmitError(validationMessage);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          distance: category === 'TROOP_GAMES' ? undefined : distanceNumber,
          pace: category === 'RUN' ? paceNumber : undefined,
          companionUserId: withFriend ? companionUserId : undefined,
          proofUrl: proofUrl || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to submit activity.');
      router.push('/dashboard?activitySubmitted=true');
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit activity.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" />Back to athlete hub</Link>
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
            <header><p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-400">New submission</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Log an activity</h1><p className="mt-3 text-slate-400">Add the details below. Your activity enters the admin review queue before points are awarded.</p></header>

            <FormSection number="1" title="Choose an activity" subtitle="Scoring changes based on the activity type.">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {ACTIVITY_CATEGORIES.map((item) => (
                  <button key={item.value} type="button" onClick={() => chooseCategory(item.value)} aria-pressed={category === item.value} className={`rounded-2xl border p-4 text-left transition ${category === item.value ? 'border-orange-400 bg-orange-400/10 ring-1 ring-orange-400/30' : 'border-white/10 bg-black/10 hover:bg-white/5'}`}>
                    <span className="text-2xl">{item.icon}</span><span className="mt-3 block text-sm font-black">{item.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{scoringDescription(item.value, scoringRules)}</span>
                  </button>
                ))}
              </div>
            </FormSection>

            <FormSection number="2" title="Enter your result" subtitle="Use the figures shown in your fitness app or screenshot.">
              <div className="grid gap-4 sm:grid-cols-2">
                {category !== 'TROOP_GAMES' ? <label className="block"><span className="text-sm font-semibold text-slate-300">Distance ({category === 'SWIM' ? 'metres' : 'km'})</span><input type="number" min="0" step={category === 'SWIM' ? '1' : '0.01'} required value={distance} onChange={(event) => setDistance(event.target.value)} placeholder={category === 'SWIM' ? 'e.g. 1000' : 'e.g. 5.00'} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-orange-400" /></label> : <div className="rounded-xl border border-violet-400/20 bg-violet-400/10 p-4 text-sm text-violet-200 sm:col-span-2"><Info className="mb-2 h-5 w-5" />Troop Games earn {scoringRules.troopGamePoints} points per approved session. No distance is required.</div>}
                {category === 'RUN' ? <label className="block"><span className="text-sm font-semibold text-slate-300">Average pace (min/km)</span><input type="text" inputMode="decimal" value={pace} onChange={(event) => setPace(event.target.value)} placeholder="e.g. 6:30" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-orange-400" /><span className="mt-2 block text-xs text-slate-500">You may enter 6:30 or 6.5. Above {scoringRules.runSlowPaceThreshold}:00/km is scored as Walk / Hike.</span></label> : null}
              </div>
            </FormSection>

            <FormSection number="3" title="Add a teammate" subtitle={`A registered companion adds the official ${scoringRules.friendBonus}-point friend bonus.`}>
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${withFriend ? 'border-sky-400/30 bg-sky-400/10' : 'border-white/10 bg-black/10'}`}><input type="checkbox" checked={withFriend} onChange={(event) => { setWithFriend(event.target.checked); if (!event.target.checked) setCompanionUserId(''); }} className="h-4 w-4 accent-sky-400" /><Users className="h-5 w-5 text-sky-300" /><span className="text-sm font-bold">I completed this with a registered participant</span></label>
              {withFriend ? <label className="mt-4 block"><span className="text-sm font-semibold text-slate-300">Companion</span><select required value={companionUserId} onChange={(event) => setCompanionUserId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-sky-400"><option value="">Select a participant…</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label> : null}
            </FormSection>

            <FormSection number="4" title="Attach proof" subtitle="Upload a clear screenshot from Strava, Garmin, or another fitness app.">
              {proofUrl ? (
                <div className="relative h-60 overflow-hidden rounded-2xl border border-white/10 bg-black/20"><Image src={proofUrl} alt="Uploaded activity proof" fill unoptimized sizes="(max-width: 1024px) 100vw, 700px" className="object-contain" /><button type="button" onClick={() => setProofUrl('')} aria-label="Remove proof image" className="absolute right-3 top-3 rounded-full bg-rose-500 p-2 text-white shadow-lg transition hover:bg-rose-400"><X className="h-4 w-4" /></button></div>
              ) : (
                <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-black/10 px-5 text-center transition hover:border-orange-400/50 hover:bg-orange-400/5"><ImagePlus className="h-8 w-8 text-slate-500" /><span className="mt-3 font-bold text-slate-300">{uploading ? 'Uploading proof…' : 'Choose proof screenshot'}</span><span className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP or GIF · maximum 4MB</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} disabled={uploading} className="hidden" /></label>
              )}
              {uploadError ? <p className="mt-3 text-sm text-rose-300">{uploadError}</p> : null}
            </FormSection>

            {submitError ? <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{submitError}</div> : null}
            <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end"><Link href="/dashboard" className="rounded-xl border border-white/10 px-5 py-3 text-center text-sm font-bold text-slate-300 transition hover:bg-white/5">Cancel</Link><button type="submit" disabled={submitting || uploading || Boolean(validationMessage)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />{submitting ? 'Submitting…' : 'Submit for review'}</button></div>
          </form>

          <aside className="space-y-4 lg:sticky lg:top-6">
            <div className="rounded-3xl border border-orange-400/20 bg-gradient-to-b from-orange-400/10 to-white/[0.04] p-6"><div className="flex items-center gap-2 text-orange-300"><Sparkles className="h-5 w-5" /><p className="text-sm font-black uppercase tracking-wider">Live score preview</p></div><p className="mt-5 text-5xl font-black">{preview.totalPoints.toFixed(1)}</p><p className="mt-1 text-sm text-slate-400">estimated points</p><div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm"><PreviewRow label="Base activity" value={preview.basePoints.toFixed(1)} /><PreviewRow label="Friend bonus" value={`+${preview.friendBonus.toFixed(1)}`} /><PreviewRow label="Review status" value="Pending" /></div></div>
            {effectiveCategory !== category ? <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100"><strong>Scoring adjustment:</strong> this pace will be reviewed as Walk / Hike.</div> : null}
            {validationMessage ? <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400"><Info className="mb-2 h-5 w-5 text-sky-300" />{validationMessage}</div> : null}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs leading-5 text-slate-500"><Upload className="mb-2 h-4 w-4" />The preview follows the current challenge rules. Admins may correct details when checking your evidence.</div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function FormSection({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="border-t border-white/10 pt-6"><div className="mb-5 flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-black">{number}</span><div><h2 className="font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div></div>{children}</section>;
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-slate-500">{label}</span><span className="font-bold text-slate-200">{value}</span></div>;
}
