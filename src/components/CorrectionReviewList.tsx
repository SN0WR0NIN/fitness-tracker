'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ActivityProof from '@/components/ActivityProof';
import type { CorrectionRecord,CorrectionSnapshot } from '@/lib/activity-corrections';
export type CorrectionDisplay=Omit<CorrectionRecord,'createdAt'|'reviewedAt'> & {createdAt:string;reviewedAt:string|null};

export default function CorrectionReviewList({items,admin=false,locked=false}:{items:CorrectionDisplay[];admin?:boolean;locked?:boolean}) {
  return <div className="space-y-5">{items.length?items.map((item)=><CorrectionCard key={item.id} item={item} admin={admin} locked={locked}/>):<p className="rounded-2xl border border-white/10 p-6 text-slate-400">No correction requests in this view.</p>}</div>;
}
function CorrectionCard({item,admin,locked}:{item:CorrectionDisplay;admin:boolean;locked:boolean}) {
  const router=useRouter();
  const [reason,setReason]=useState('');const [override,setOverride]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const [matches,setMatches]=useState<Array<{id:string;reason:string}>>([]);
  async function decide(decision:'APPROVED'|'REJECTED'|'CANCELLED') {
    if(!window.confirm(decision==='APPROVED'?'Approve this correction and recalculate the affected weekly and column totals?':decision==='REJECTED'?'Reject this request and keep the original activity unchanged?':'Cancel your correction request? Your activity stays unchanged.'))return;
    setBusy(true);setMessage('');
    try {
      const response=await fetch(admin?'/api/admin/corrections':'/api/corrections',{method:admin?'POST':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(admin?{id:item.id,decision,reason,...(override.trim()?{duplicateOverrideReason:override}:{})}:{id:item.id,action:'cancel'})});
      const result=await response.json();
      if(result.details?.matches)setMatches(result.details.matches);
      if(!response.ok){if(result.status==='STALE')router.refresh();throw new Error(result.error || result.message || 'Could not complete request');}
      setMessage(result.dirtyWeeks?.length?`Approved. Rebuild finalized week(s) ${result.dirtyWeeks.join(', ')} in Weekly awards.`:`Request ${String(result.status).toLowerCase()}.`);router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:'Request failed');}finally{setBusy(false);}
  }
  return <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-black">{admin?item.participantName:'Activity correction'}</h2><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{item.status}</span></header>
    <p className="mt-2 break-all text-xs text-slate-400">Activity {item.activityId} · Requested {new Date(item.createdAt).toLocaleString('en-SG',{timeZone:'Asia/Singapore'})}</p>
    <p className="mt-4 whitespace-pre-wrap text-sm"><strong>Participant reason:</strong> {item.reason}</p>
    <div className="mt-5 grid gap-4 md:grid-cols-2"><Snapshot title="Original approved entry" value={item.original}/><Snapshot title={item.applied?'Applied correction':'Proposed correction'} value={item.applied ?? item.proposed}/></div>
    {!item.applied&&item.status==='OPEN'?<p className="mt-3 text-xs text-slate-400">Proposed points are a preview. Approval recalculates using the current rules and checks for duplicates; the original stays unchanged until then.</p>:null}
    {item.decisionReason?<p className="mt-4 whitespace-pre-wrap text-sm text-sky-100"><strong>Decision:</strong> {item.decisionReason}</p>:null}
    {item.status==='OPEN'?<div className="mt-5 space-y-4 border-t border-white/10 pt-4">
      {locked?<p className="text-sm text-amber-200">Competition changes are currently locked.</p>:null}
      {admin?<label className="block text-sm font-bold">Decision explanation<textarea disabled={busy||locked} minLength={5} maxLength={1000} value={reason} onChange={(e)=>setReason(e.target.value)} className="mt-2 block min-h-20 w-full rounded-xl border border-white/20 bg-slate-900 p-3"/></label>:null}
      {matches.length?<div className="space-y-3 rounded-xl border border-amber-300/30 p-4"><p className="font-bold text-amber-200">Possible duplicates found. Review these entries before overriding.</p>{matches.map((match)=><p key={match.id} className="break-all text-sm">{match.id}: {match.reason}</p>)}<Link href="/admin/activities" className="inline-block text-sm font-bold text-sky-200">Open activity review →</Link><label className="block text-sm">Why are these different workouts?<textarea minLength={10} maxLength={1000} value={override} onChange={(e)=>setOverride(e.target.value)} className="mt-2 block min-h-20 w-full rounded-xl border border-white/20 bg-slate-900 p-3"/></label></div>:null}
      <div className="flex flex-wrap gap-3">{admin?<><button type="button" onClick={()=>void decide('APPROVED')} disabled={busy||locked||reason.trim().length<5||(matches.length>0&&override.trim().length<10)} className="min-h-11 rounded-xl bg-lime-300 px-4 font-bold text-slate-950 disabled:opacity-40">Approve correction</button><button type="button" onClick={()=>void decide('REJECTED')} disabled={busy||locked||reason.trim().length<5} className="min-h-11 rounded-xl border border-rose-300/30 px-4 font-bold text-rose-200 disabled:opacity-40">Reject request</button></>:<button type="button" onClick={()=>void decide('CANCELLED')} disabled={busy||locked} className="min-h-11 rounded-xl border border-white/20 px-4 font-bold disabled:opacity-40">Cancel request</button>}</div>
    </div>:null}
    <p role="status" aria-live="polite" className="mt-3 text-sm text-sky-200">{busy?'Saving…':message}</p>
  </article>;
}
function Snapshot({title,value}:{title:string;value:CorrectionSnapshot}) {
  const fields=[['Date (Singapore)',value.activityDate],['Type',value.category.replaceAll('_',' ')],['Distance',`${value.distance} ${value.category==='SWIM'?'m':'km'}`],['Pace',value.pace===null?'Not supplied':`${value.pace} min/km`],['Duration',value.duration===null?'Not supplied':`${value.duration} minutes`],['Companion',value.companionName || 'None'],['Week',String(value.weekNumber)],['Points',value.points.toFixed(1)]];
  return <section className="min-w-0 rounded-xl border border-white/10 bg-black/10 p-4"><h3 className="mb-4 text-sm font-black text-lime-200">{title}</h3><dl className="space-y-2">{fields.map(([label,text])=><div key={label} className="flex justify-between gap-3 text-sm"><dt className="shrink-0 text-slate-400">{label}</dt><dd className="break-words text-right">{text}</dd></div>)}</dl><div className="mt-4"><ActivityProof proofUrl={value.proofUrl} label={`${title} proof`}/></div></section>;
}
