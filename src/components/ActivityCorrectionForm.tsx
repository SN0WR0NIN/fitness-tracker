'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ActivityProof from '@/components/ActivityProof';
import type { CorrectionSnapshot } from '@/lib/activity-corrections';

export default function ActivityCorrectionForm({ activityId, original, users, startDate, endDate, locked, strava }: { activityId:string; original:CorrectionSnapshot; users:Array<{id:string;name:string}>; startDate:string; endDate:string; locked:boolean; strava:boolean }) {
  const router=useRouter();
  const [date,setDate]=useState(original.activityDate);
  const [category,setCategory]=useState(original.category);
  const [distance,setDistance]=useState(String(original.distance));
  const [pace,setPace]=useState(original.pace === null ? '' : String(original.pace));
  const [duration,setDuration]=useState(original.duration === null ? '' : String(original.duration));
  const [companion,setCompanion]=useState(original.companionUserId ?? '');
  const [proof,setProof]=useState(original.proofUrl ?? '');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [submitted,setSubmitted]=useState(false);
  const [uploading,setUploading]=useState(false);
  const input='mt-2 block min-h-11 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white';
  async function upload(file:File|undefined) {
    if (!file) return;
    setUploading(true);setMessage('');
    try {const form=new FormData();form.append('file',file);const response=await fetch('/api/upload',{method:'POST',body:form});const result=await response.json();if(!response.ok)throw new Error(result.error || 'Upload failed');setProof(result.url);} catch(error){setMessage(error instanceof Error?error.message:'Upload failed');} finally{setUploading(false);}
  }
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setMessage('');
    try {
      const proposed={activityDate:date,category,distance:category==='TROOP_GAMES'?0:Number(distance),pace:pace===''?null:Number(pace),duration:duration===''?null:Number(duration),companionUserId:companion || null,proofUrl:proof.trim() || null};
      const response=await fetch('/api/corrections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activityId,reason,proposed})});
      const result=await response.json();if(!response.ok)throw new Error(result.error || 'Could not send request');
      setSubmitted(true);setMessage(result.message);router.refresh();
    } catch(error){setMessage(error instanceof Error?error.message:'Could not send request');} finally{setBusy(false);}
  }
  if(submitted)return <section className="space-y-4 rounded-2xl border border-emerald-300/30 p-5"><p role="status">{message}</p><Link href="/corrections" className="inline-flex min-h-11 items-center rounded-xl bg-lime-300 px-4 font-bold text-slate-950">Track my request</Link></section>;
  return <form onSubmit={submit} className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
    <p className="rounded-xl border border-sky-300/20 bg-sky-300/5 p-4 text-sm text-sky-100">Currently approved: {original.points.toFixed(1)} points in Week {original.weekNumber}. Nothing changes until an admin approves your request. Approved corrections use the current scoring rules.</p>
    {locked?<p role="alert" className="text-amber-200">Corrections are temporarily paused. Your existing activity is unchanged.</p>:null}
    {strava?<p className="text-sm text-slate-400">This changes only the challenge entry, not your original Strava workout or its source link.</p>:null}
    <fieldset disabled={busy || uploading || locked} className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-bold">Activity date (Singapore)<input required type="date" min={startDate} max={endDate} value={date} onChange={(e)=>setDate(e.target.value)} className={input}/></label>
      <label className="text-sm font-bold">Activity type<select value={category} onChange={(e)=>setCategory(e.target.value as CorrectionSnapshot['category'])} className={input}><option value="RUN">Run</option><option value="CYCLE">Cycle</option><option value="SWIM">Swim</option><option value="WALK_OR_HIKE">Walk / Hike</option><option value="TROOP_GAMES">Troop Games</option></select></label>
      {category!=='TROOP_GAMES'?<label className="text-sm font-bold">Distance ({category==='SWIM'?'metres':'km'})<input required type="number" min="0.001" max="100000" step="any" value={distance} onChange={(e)=>setDistance(e.target.value)} className={input}/></label>:null}
      <label className="text-sm font-bold">Pace (minutes per km, optional)<input type="number" min="0.001" max="60" step="any" value={pace} onChange={(e)=>setPace(e.target.value)} className={input}/><span className="mt-1 block text-xs font-normal text-slate-400">For example, 5:30/km = 5.5. Run scoring uses this value.</span></label>
      <label className="text-sm font-bold">Duration (whole minutes, optional)<input type="number" min="1" max="100000" step="1" value={duration} onChange={(e)=>setDuration(e.target.value)} className={input}/></label>
      <label className="text-sm font-bold">Registered companion<select value={companion} onChange={(e)=>setCompanion(e.target.value)} className={input}><option value="">{original.companionName && !original.companionUserId?`Keep admin-verified companion: ${original.companionName}`:'No companion'}</option>{users.map((u)=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      <label className="text-sm font-bold sm:col-span-2">Proof link (optional)<input type="url" maxLength={2048} value={proof} onChange={(e)=>setProof(e.target.value)} className={input}/></label>
      <label className="text-sm font-bold sm:col-span-2">Upload replacement proof<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e)=>void upload(e.target.files?.[0])} className={input}/></label>
      <label className="text-sm font-bold sm:col-span-2">Reason for correction<textarea required minLength={5} maxLength={1000} value={reason} onChange={(e)=>setReason(e.target.value)} className={`${input} min-h-24`}/></label>
    </fieldset>
    <ActivityProof proofUrl={proof || null} label="Proposed activity proof"/>
    <p role="status" aria-live="polite" className="text-sm text-sky-200">{uploading?'Uploading proof…':message}</p>
    <button disabled={busy || uploading || locked} className="min-h-11 rounded-xl bg-lime-300 px-5 py-3 font-black text-slate-950 disabled:opacity-40">{busy?'Sending…':'Send correction request'}</button>
  </form>;
}
