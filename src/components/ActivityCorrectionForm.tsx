'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, Info, Users } from 'lucide-react';
import FriendMultiSelect from '@/components/FriendMultiSelect';
import ActivityProof from '@/components/ActivityProof';
import { activityFriendIds } from '@/lib/friend-selection';
import type { CorrectionSnapshot } from '@/lib/activity-corrections';
import { maskPaceInput, normalizePaceInput, parsePaceInput } from '@/lib/pace-input';


export default function ActivityCorrectionForm({ activityId, original, users, startDate, endDate, locked, strava }: { activityId:string; original:CorrectionSnapshot; users:Array<{id:string;name:string}>; startDate:string; endDate:string; locked:boolean; strava:boolean }) {
  const router=useRouter();
  const originalFriends=useMemo(()=>activityFriendIds(original),[original]);
  const [date,setDate]=useState(original.activityDate);
  const [category,setCategory]=useState(original.category);
  const [distance,setDistance]=useState(String(original.distance));
  const [pace,setPace]=useState(normalizePaceInput(original.pace));
  const [duration,setDuration]=useState(original.duration === null ? '' : String(original.duration));
  const [withFriend,setWithFriend]=useState(Boolean(original.completedWithFriend || original.companionName || originalFriends.length));
  const [companion,setCompanion]=useState<string[]>(originalFriends);
  const [proof,setProof]=useState(original.proofUrl ?? '');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [submitted,setSubmitted]=useState(false);
  const [uploading,setUploading]=useState(false);
  const input='mt-2 block min-h-11 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white outline-none focus:border-orange-400';
  const hasLegacyCompanion=Boolean(original.companionName && !original.companionUserId && !originalFriends.length);

  async function upload(file:File|undefined) {
    if (!file) return;
    setUploading(true);setMessage('');
    try {
      const form=new FormData();form.append('file',file);
      const response=await fetch('/api/upload',{method:'POST',body:form});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error || 'Upload failed');
      setProof(result.url);
    } catch(error){setMessage(error instanceof Error?error.message:'Upload failed');}
    finally{setUploading(false);}
  }

  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setMessage('');
    const parsedPace=pace.trim()?parsePaceInput(pace):null;
    if(parsedPace===undefined){setMessage('Enter pace as min:sec. Type 545 for 5:45/km.');return;}
    if(withFriend && companion.length===0 && !hasLegacyCompanion){setMessage('Select at least one registered friend to request the friend bonus.');return;}
    if(!proof.trim()){setMessage('Photo proof is required for an approved-entry edit. Upload a proof image before submitting.');return;}
    setBusy(true);
    try {
      const proposed={
        activityDate:date,
        category,
        distance:category==='TROOP_GAMES'?0:Number(distance),
        pace:parsedPace,
        duration:duration===''?null:Number(duration),
        companionUserId:withFriend?(companion[0] ?? null):null,
        companionUserIds:withFriend?companion:[],
        completedWithFriend:withFriend,
        proofUrl:proof.trim(),
      };
      const response=await fetch('/api/corrections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activityId,reason,proposed})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error || 'Could not submit edits');
      setSubmitted(true);setMessage(result.message);router.refresh();
    } catch(error){setMessage(error instanceof Error?error.message:'Could not submit edits');}
    finally{setBusy(false);}
  }

  if(submitted)return <section className="space-y-4 rounded-2xl border border-emerald-300/30 bg-emerald-300/[0.04] p-5"><CheckCircle2 className="h-8 w-8 text-emerald-300"/><p role="status">{message}</p><p className="text-sm text-slate-400">Your existing approved score remains unchanged until an admin reviews the edit.</p><div className="flex flex-wrap gap-3"><Link href="/activities/history" className="inline-flex min-h-11 items-center rounded-xl bg-lime-300 px-4 font-bold text-slate-950">Back to My Activities</Link><Link href="/corrections" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 font-bold">Track edit request</Link></div></section>;

  return <form onSubmit={submit} className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
    <div className="rounded-xl border border-sky-300/20 bg-sky-300/5 p-4 text-sm text-sky-100"><strong>Currently approved:</strong> {original.points.toFixed(1)} points in Week {original.weekNumber}. You can edit the details below, but the approved activity and leaderboard stay unchanged until an admin accepts the edit.</div>
    {locked?<p role="alert" className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">This entry cannot be edited while competition changes or its week are locked. An administrator must reopen the week first if it has been finalised.</p>:null}
    {strava?<p className="text-sm text-slate-400">Editing this challenge entry does not modify the original Strava workout or its source link.</p>:null}

    <fieldset disabled={busy || uploading || locked} className="space-y-6">
      <section className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-bold">Activity date (Singapore)<input required type="date" min={startDate} max={endDate} value={date} onChange={(e)=>setDate(e.target.value)} className={input}/></label>
        <label className="text-sm font-bold">Activity type<select aria-label="Activity type" value={category} onChange={(e)=>setCategory(e.target.value as CorrectionSnapshot['category'])} className={input}><option value="RUN">Run</option><option value="CYCLE">Cycle</option><option value="SWIM">Swim</option><option value="WALK_OR_HIKE">Walk / Hike</option><option value="TROOP_GAMES">Troop Games</option></select></label>
        {category!=='TROOP_GAMES'?<label className="text-sm font-bold">Distance ({category==='SWIM'?'metres':'km'})<input required type="number" min="0.001" max="100000" step="any" value={distance} onChange={(e)=>setDistance(e.target.value)} className={input}/></label>:null}
        <label className="text-sm font-bold">Pace (min/km)<input inputMode="numeric" maxLength={5} autoComplete="off" value={pace} onChange={(e)=>setPace(maskPaceInput(e.target.value))} placeholder="5:45" className={input}/><span className="mt-1 block text-xs font-normal text-slate-400">Type only the digits; 545 becomes 5:45. Run scoring will be recalculated from the approved value.</span></label>
        <label className="text-sm font-bold">Duration (whole minutes, optional)<input type="number" min="1" max="100000" step="1" value={duration} onChange={(e)=>setDuration(e.target.value)} className={input}/></label>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/10 p-4 sm:p-5">
        <div className="flex items-start gap-3"><Users className="mt-0.5 h-5 w-5 text-sky-300"/><div><h2 className="font-black">Friend bonus</h2><p className="mt-1 text-xs text-slate-400">Add or remove friends here. The bonus itself is never typed manually; it is recalculated automatically under the daily friend-bonus rules when an admin approves the edit.</p></div></div>
        <label className={`mt-4 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-4 ${withFriend?'border-sky-400/30 bg-sky-400/10':'border-white/10 bg-slate-900/40'}`}><input type="checkbox" checked={withFriend} onChange={(e)=>{setWithFriend(e.target.checked);if(!e.target.checked)setCompanion([]);}} className="h-4 w-4 accent-sky-400"/><span className="font-bold">I completed this activity with friends</span></label>
        {withFriend?<div className="mt-4"><FriendMultiSelect users={users} value={companion} onChange={setCompanion} disabled={busy || uploading || locked}/>{hasLegacyCompanion && !companion.length?<p className="mt-2 text-xs text-slate-400">Current verified companion: {original.companionName}. Leave the friend option on to keep it, or switch it off to remove the friend bonus.</p>:null}</div>:<p className="mt-3 text-sm text-slate-500">This edit will remove the activity's friend status and any friend bonus that applies after recalculation.</p>}
      </section>

      <section className="rounded-2xl border border-orange-300/15 bg-orange-300/[0.04] p-4 sm:p-5">
        <div className="flex items-start gap-3"><Camera className="mt-0.5 h-5 w-5 text-orange-300"/><div><h2 className="font-black">Photo proof</h2><p className="mt-1 text-xs text-slate-400">Keep the current proof or upload a replacement screenshot. Photo proof is required for the edit request.</p></div></div>
        <div className="mt-4"><ActivityProof proofUrl={proof || null} label="Proof for edited activity"/></div>
        <label className="mt-4 block text-sm font-bold">Upload replacement proof<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e)=>void upload(e.target.files?.[0])} className={input}/></label>
      </section>

      <label className="block text-sm font-bold">Reason for edit<textarea required minLength={5} maxLength={1000} value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Briefly explain what needs to be corrected." className={`${input} min-h-24`}/></label>
    </fieldset>

    <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/10 p-3 text-xs text-slate-400"><Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300"/>Distance, pace and friend changes may change the activity's points. The revised score is only applied after admin approval.</div>
    <p role="status" aria-live="polite" className="text-sm text-sky-200">{uploading?'Uploading proof…':message}</p>
    <div className="flex flex-wrap gap-3"><Link href="/activities/history" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-5 py-3 font-bold text-slate-300">Cancel</Link><button disabled={busy || uploading || locked || reason.trim().length<5 || !proof.trim()} className="min-h-11 rounded-xl bg-lime-300 px-5 py-3 font-black text-slate-950 disabled:opacity-40">{busy?'Submitting edits…':'Submit edits for review'}</button></div>
  </form>;
}
