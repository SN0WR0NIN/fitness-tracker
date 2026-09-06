'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NotificationPreferences } from '@/lib/notification-preferences';
const options:Array<{key:keyof NotificationPreferences;label:string;description:string}>=[
  {key:'activity_reviews',label:'Activity decisions',description:'Activity approval and rejection updates.'},
  {key:'correction_updates',label:'Correction updates',description:'Decisions and stale-request notices for your corrections.'},
  {key:'achievements',label:'Achievement unlocks',description:'New milestone and achievement badges.'},
  {key:'weekly_results',label:'Weekly awards and results',description:'Finalized weekly standings and awards you receive.'},
  {key:'goal_reminders',label:'Weekly goal reminders',description:'Progress milestones and reminders before the weekly cutoff.'},
];
export default function NotificationPreferencesForm({initial}:{initial:NotificationPreferences}){
  const [value,setValue]=useState(initial);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const router=useRouter();
  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage('');
    try{const response=await fetch('/api/account/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const result=await response.json();if(!response.ok)throw new Error(result.error || 'Unable to save preferences');setValue(result);setMessage('Notification preferences saved for your account across devices.');window.dispatchEvent(new Event('kg:notifications-changed'));router.refresh();}catch(error){setMessage(error instanceof Error?error.message:'Unable to save preferences');}finally{setBusy(false);}
  }
  return <form onSubmit={save} className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-7"><fieldset disabled={busy} className="divide-y divide-white/10">{options.map((option)=><label key={option.key} className="flex min-h-20 cursor-pointer items-center justify-between gap-5 py-4"><span><span className="block font-bold">{option.label}</span><span className="mt-1 block text-sm text-slate-400">{option.description}</span></span><input type="checkbox" checked={value[option.key]} onChange={(event)=>setValue((current)=>({...current,[option.key]:event.target.checked})) className="h-6 w-6 shrink-0 accent-lime-300"/></label>)}</fieldset><p className="text-sm leading-6 text-slate-400">These choices filter your in-app bell and Notification Centre. Essential security and maintenance notices remain visible. Muting an update does not delete the activity, correction history or earned badge. No email or background push subscription is created here.</p><button disabled={busy} className="min-h-11 rounded-xl bg-lime-300 px-5 py-3 font-black text-slate-950 disabled:opacity-40">{busy?'Saving…':'Save notification preferences'}</button><p role="status" aria-live="polite" className="text-sm text-sky-200">{message}</p></form>;
}
