'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, CheckCircle2, CloudOff, ImagePlus, Info, Save, Sparkles, Users, X } from 'lucide-react';
import { singaporeDate, parseActivityDate } from '@/lib/activity-date';
import Navbar from '@/components/Navbar';
import { calculateActivityPoints, resolveEffectiveCategory, type ActivityCategory, type ScoringRules } from '@/lib/scoring';

type SelectableUser = { id: string; name: string };
type ActivityDraft = { activityDate: string; category: ActivityCategory; distance: string; pace: string; withFriend: boolean; companionUserId: string; proofUrl: string };
type ActivityPayload = { activityDate: string; category: ActivityCategory; distance?: number; pace?: number; companionUserId?: string; proofUrl?: string };

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

export default function NewActivityForm({ userId, scoringRules, maintenanceMode, maintenanceMessage }: { userId: string; scoringRules: ScoringRules; maintenanceMode: boolean; maintenanceMessage: string }) {
  const router = useRouter();
  const [category, setCategory] = useState<ActivityCategory>('RUN');
  const [activityDate, setActivityDate] = useState('');
  const [distance, setDistance] = useState('');
  const [pace, setPace] = useState('');
  const [withFriend, setWithFriend] = useState(false);
  const [companionUserId, setCompanionUserId] = useState('');
  const [users, setUsers] = useState<SelectableUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [usersLoadAttempt, setUsersLoadAttempt] = useState(0);
  const [proofUrl, setProofUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [online, setOnline] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [queued, setQueued] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const draftKey = `kg-activity-draft:${userId}`;
  const queueKey = `kg-activity-queue:${userId}`;
  const categoryKey = `kg-last-activity:v1:${userId}`;

  useEffect(() => {
    queueMicrotask(() => {
      setOnline(window.navigator.onLine);
      setActivityDate(singaporeDate());
      try {
        const lastCategory = window.localStorage.getItem(categoryKey);
        if (ACTIVITY_CATEGORIES.some((item) => item.value === lastCategory)) setCategory(lastCategory as ActivityCategory);
        const saved = window.localStorage.getItem(draftKey);
        if (saved) {
          const draft = JSON.parse(saved) as Partial<ActivityDraft>;
          if (ACTIVITY_CATEGORIES.some((item) => item.value === draft.category)) setCategory(draft.category!);
          setActivityDate(draft.activityDate || singaporeDate());
          setDistance(draft.distance || '');
          setPace(draft.pace || '');
          setWithFriend(Boolean(draft.withFriend));
          setCompanionUserId(draft.companionUserId || '');
          setProofUrl(draft.proofUrl || '');
          setDraftStatus('Saved draft restored from this device.');
        }
        setQueued(Boolean(window.localStorage.getItem(queueKey)));
      } catch {
        window.localStorage.removeItem(draftKey);
        window.localStorage.removeItem(queueKey);
      }
      setDraftReady(true);
    });
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [categoryKey, draftKey, queueKey]);

  useEffect(() => {
    if (!draftReady) return;
    const draft: ActivityDraft = { activityDate, category, distance, pace, withFriend, companionUserId, proofUrl };
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [activityDate, category, companionUserId, distance, draftKey, draftReady, pace, proofUrl, withFriend]);

  useEffect(() => {
    if (!withFriend || usersLoaded) return;
    const controller = new AbortController();
    setUsersLoading(true);
    setUsersError('');
    fetch('/api/users', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data)) throw new Error('Unable to load participants.');
        return data as SelectableUser[];
      })
      .then((list) => {
        if (controller.signal.aborted) return;
        setUsers(list);
        setUsersLoading(false);
        setUsersLoaded(true);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setUsersLoading(false);
        setUsersError(error instanceof Error ? error.message : 'Unable to load participants.');
      });
    return () => controller.abort();
  }, [usersLoadAttempt, usersLoaded, withFriend]);

  useEffect(() => {
    if (!online || !queued || !draftReady || maintenanceMode) return;
    const pending = window.localStorage.getItem(queueKey);
    if (!pending) { queueMicrotask(() => setQueued(false)); return; }
    queueMicrotask(() => {
      setSubmitting(true);
      setSubmitError('Connection restored. Submitting your queued activity…');
      fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: pending })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Queued activity could not be submitted.');
        window.localStorage.removeItem(queueKey);
        window.localStorage.removeItem(draftKey);
        setQueued(false);
        router.push('/dashboard?activitySubmitted=true');
        router.refresh();
      })
      .catch((error) => {
        window.localStorage.removeItem(queueKey);
        setQueued(false);
        setSubmitError(`${error instanceof Error ? error.message : 'Queued activity could not be submitted.'} Your draft is still saved.`);
      })
      .finally(() => setSubmitting(false));
    });
  }, [draftKey, draftReady, maintenanceMode, online, queueKey, queued, router]);

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
    if (!parseActivityDate(activityDate)) return 'Choose a valid activity date, today or earlier.';
    if (category !== 'TROOP_GAMES' && (!distanceNumber || distanceNumber <= 0)) return 'Enter a distance greater than zero.';
    if (category === 'WALK_OR_HIKE' && distanceNumber && distanceNumber < scoringRules.walkMinimumKm) return `Walks under ${scoringRules.walkMinimumKm}km do not earn points.`;
    if (category === 'RUN' && pace && (paceNumber === undefined || paceNumber <= 0)) return 'Use a positive pace such as 6:30 or 6.5.';
    if (withFriend && !companionUserId) return 'Select the registered friend who joined you.';
    return '';
  }, [activityDate, category, distanceNumber, pace, paceNumber, withFriend, companionUserId, scoringRules.walkMinimumKm]);

  const chooseCategory = (nextCategory: ActivityCategory) => {
    setCategory(nextCategory);
    try { window.localStorage.setItem(categoryKey, nextCategory); } catch { /* Optional preference: continue when storage is unavailable. */ }
    if (nextCategory !== 'RUN') setPace('');
    if (nextCategory === 'TROOP_GAMES') setDistance('');
    setSubmitError('');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError('');
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setUploadError('Choose a JPEG, PNG, WebP or GIF image. For HEIC photos, export a JPEG or take a screenshot.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('The image is larger than 4MB. Please choose a smaller screenshot.');
      event.target.value = '';
      return;
    }

    if (!online) {
      setUploadError('Reconnect before uploading a proof image. Your activity details are still saved.');
      event.target.value = '';
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    const input = event.target;
    try {
      const body = new FormData();
      body.append('file', file);
      const url = await new Promise<string>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', '/api/upload');
        request.timeout = 90000;
        request.upload.onprogress = (progress) => {
          if (progress.lengthComputable) setUploadProgress(Math.round(progress.loaded / progress.total * 100));
        };
        request.onerror = () => reject(new Error('Connection interrupted. Check your connection and choose the image again.'));
        request.ontimeout = () => reject(new Error('Upload timed out. Try a smaller screenshot or a stronger connection.'));
        request.onload = () => {
          try {
            const data = JSON.parse(request.responseText);
            if (request.status < 200 || request.status >= 300 || typeof data.url !== 'string') {
              reject(new Error(typeof data.error === 'string' ? data.error : 'Upload failed. Please choose the image again.'));
            } else resolve(data.url);
          } catch { reject(new Error('Upload failed. Please choose the image again.')); }
        };
        request.send(body);
      });
      setProofUrl(url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload proof.');
    } finally {
      setUploading(false);
      input.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError('');
    if (validationMessage) {
      setSubmitError(validationMessage);
      return;
    }

    const payload: ActivityPayload = {
      activityDate,
      category,
      distance: category === 'TROOP_GAMES' ? undefined : distanceNumber,
      pace: category === 'RUN' ? paceNumber : undefined,
      companionUserId: withFriend ? companionUserId : undefined,
      proofUrl: proofUrl || undefined,
    };
    if (!online) {
      window.localStorage.setItem(queueKey, JSON.stringify(payload));
      setQueued(true);
      setSubmitError('Activity queued on this device. It will submit once your connection returns.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to submit activity.');
      window.localStorage.removeItem(queueKey);
      window.localStorage.removeItem(draftKey);
      router.push('/dashboard?activitySubmitted=true');
      router.refresh();
    } catch (error) {
      setSubmitError(`${error instanceof Error ? error.message : 'Failed to submit activity.'} Your draft remains saved on this device.`);
    } finally {
      setSubmitting(false);
    }
  };

  const clearDraft = () => {
    setActivityDate(singaporeDate()); setCategory('RUN'); setDistance(''); setPace(''); setWithFriend(false); setCompanionUserId(''); setProofUrl(''); setQueued(false);
    window.localStorage.removeItem(queueKey);
    window.localStorage.removeItem(draftKey);
    setDraftStatus('Draft cleared.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" />Back to athlete hub</Link>

        <div className="sticky top-3 z-40 mb-5 mt-4 overflow-hidden rounded-2xl border border-orange-300/20 bg-slate-950/90 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex min-h-14 items-center gap-3 px-3 py-2.5 sm:px-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-400/10 text-orange-300"><Sparkles className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-orange-300">Live score</p>
              <p className="hidden text-[0.7rem] text-slate-500 sm:block">Updates while you enter the activity</p>
            </div>
            <div className="ml-auto flex shrink-0 items-baseline gap-1"><span className="text-2xl font-black leading-none text-white sm:text-3xl">{preview.totalPoints.toFixed(1)}</span><span className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">pts</span></div>
            <div className="hidden shrink-0 items-center gap-3 border-l border-white/10 pl-3 text-[0.7rem] md:flex"><span className="text-slate-500">Base <strong className="text-slate-200">{preview.basePoints.toFixed(1)}</strong></span><span className="text-slate-500">Friend <strong className="text-sky-300">+{preview.friendBonus.toFixed(1)}</strong></span><span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 font-black uppercase tracking-wider text-amber-200">Pending</span></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
          <header><p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-400">New submission</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Log an activity</h1><p className="mt-3 text-slate-400">Add the details below. Your activity enters the admin review queue before points are awarded.</p>{maintenanceMode ? <div role="alert" className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100"><strong>Submissions paused:</strong> {maintenanceMessage}</div> : null}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs"><span className="inline-flex items-center gap-2 text-slate-500">{online ? <Save className="h-4 w-4 text-emerald-300" /> : <CloudOff className="h-4 w-4 text-amber-300" />}{queued ? 'Waiting to submit after reconnect.' : draftStatus || (draftReady ? 'Draft saved automatically on this device.' : 'Preparing secure local draft…')}</span><button type="button" onClick={clearDraft} className="font-bold text-slate-500 transition hover:text-white">Clear draft</button></div></header>

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
            <label className="mb-5 block"><span className="text-sm font-semibold text-slate-300">Activity date</span><input type="date" required value={activityDate} max={singaporeDate()} onChange={(event) => setActivityDate(event.target.value)} className="mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-orange-400 [color-scheme:dark]" /><span className="mt-2 block text-xs text-slate-500">When you completed the activity (Singapore time). Points count towards that week after approval.</span></label>
            <div className="grid gap-4 sm:grid-cols-2">
              {category !== 'TROOP_GAMES' ? <label className="block"><span className="text-sm font-semibold text-slate-300">Distance ({category === 'SWIM' ? 'metres' : 'km'})</span><input type="number" min="0" step={category === 'SWIM' ? '1' : '0.01'} required value={distance} onChange={(event) => setDistance(event.target.value)} placeholder={category === 'SWIM' ? 'e.g. 1000' : 'e.g. 5.00'} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-orange-400" /></label> : <div className="rounded-xl border border-violet-400/20 bg-violet-400/10 p-4 text-sm text-violet-200 sm:col-span-2"><Info className="mb-2 h-5 w-5" />Troop Games earn {scoringRules.troopGamePoints} points per approved session. No distance is required.</div>}
              {category === 'RUN' ? <label className="block"><span className="text-sm font-semibold text-slate-300">Average pace (min/km)</span><input type="text" inputMode="decimal" value={pace} onChange={(event) => setPace(event.target.value)} placeholder="e.g. 6:30" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-orange-400" /><span className="mt-2 block text-xs text-slate-500">You may enter 6:30 or 6.5. Above {scoringRules.runSlowPaceThreshold}:00/km is scored as Walk / Hike.</span></label> : null}
            </div>
          </FormSection>

          <FormSection number="3" title="Add a teammate" subtitle={`A registered companion adds the official ${scoringRules.friendBonus}-point friend bonus.`}>
            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${withFriend ? 'border-sky-400/30 bg-sky-400/10' : 'border-white/10 bg-black/10'}`}><input type="checkbox" checked={withFriend} onChange={(event) => { setWithFriend(event.target.checked); if (!event.target.checked) setCompanionUserId(''); }} className="h-4 w-4 accent-sky-400" /><Users className="h-5 w-5 text-sky-300" /><span className="text-sm font-bold">I completed this with a registered participant</span></label>
            {withFriend ? <div className="mt-4"><label className="block"><span className="text-sm font-semibold text-slate-300">Companion</span><select required value={companionUserId} disabled={usersLoading || Boolean(usersError)} onChange={(event) => setCompanionUserId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-sky-400 disabled:cursor-wait disabled:opacity-60"><option value="">{usersLoading ? 'Loading participants…' : usersError ? 'Participants unavailable' : 'Select a participant…'}</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>{usersError ? <p role="alert" className="mt-2 text-xs text-rose-300">{usersError} <button type="button" onClick={() => setUsersLoadAttempt((attempt) => attempt + 1)} className="font-black underline underline-offset-2">Retry</button></p> : null}</div> : null}
          </FormSection>

          <FormSection number="4" title="Attach proof" subtitle="Upload a clear screenshot from Strava, Garmin, or another fitness app.">
            {proofUrl ? (
              <div className="relative h-60 overflow-hidden rounded-2xl border border-white/10 bg-black/20"><Image src={proofUrl} alt="Uploaded activity proof" fill unoptimized sizes="(max-width: 1024px) 100vw, 700px" className="object-contain" /><button type="button" onClick={() => setProofUrl('')} aria-label="Remove proof image" className="absolute right-3 top-3 rounded-full bg-rose-500 p-2 text-white shadow-lg transition hover:bg-rose-400"><X className="h-4 w-4" /></button></div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2"><label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-black/10 px-5 text-center transition hover:border-orange-400/50 hover:bg-orange-400/5"><Camera className="h-8 w-8 text-slate-500" /><span className="mt-3 font-bold text-slate-300">{uploading ? 'Uploading proof…' : 'Take a proof photo'}</span><span className="mt-1 text-xs text-slate-500">Open your phone&apos;s rear camera</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handleFileChange} disabled={uploading || !online || maintenanceMode} className="hidden" /></label><label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-black/10 px-5 text-center transition hover:border-sky-400/50 hover:bg-sky-400/5"><ImagePlus className="h-8 w-8 text-slate-500" /><span className="mt-3 font-bold text-slate-300">Choose screenshot</span><span className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP or GIF · maximum 4MB</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} disabled={uploading || !online || maintenanceMode} className="hidden" /></label></div>
            )}
            {uploading ? <div className="mt-4" role="status"><p className="text-sm text-sky-200">{uploadProgress === 100 ? 'Upload transferred. Saving your proof…' : `Uploading proof: ${uploadProgress}%`}</p><progress aria-label="Proof upload progress" value={uploadProgress} max={100} className="mt-2 h-2 w-full accent-orange-400" /></div> : null}
            {uploadError ? <p role="alert" className="mt-3 text-sm text-rose-300">{uploadError}</p> : null}
          </FormSection>

          {effectiveCategory !== category ? <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-sm text-yellow-100"><strong>Scoring adjustment:</strong> this pace will be reviewed as Walk / Hike.</div> : null}
          {validationMessage ? <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-400"><Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />{validationMessage}</div> : null}
          {submitError ? <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{submitError}</div> : null}
          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end"><Link href="/dashboard" className="rounded-xl border border-white/10 px-5 py-3 text-center text-sm font-bold text-slate-300 transition hover:bg-white/5">Cancel</Link><button type="submit" disabled={submitting || uploading || Boolean(validationMessage) || maintenanceMode} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />{submitting ? 'Submitting…' : !online ? 'Queue until online' : 'Submit for review'}</button></div>
        </form>
      </main>
    </div>
  );
}

function FormSection({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="border-t border-white/10 pt-6"><div className="mb-5 flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-black">{number}</span><div><h2 className="font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div></div>{children}</section>;
}
