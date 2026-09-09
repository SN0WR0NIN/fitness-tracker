'use client';
import { proofDisplayHref } from '@/lib/proof-reference';
import Image from 'next/image';
import { ExternalLink, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export default function ActivityProof({ proofUrl, proofUrls, label, compact = false }: { proofUrl?: string | null; proofUrls?: string[] | null; label: string; compact?: boolean }) {
  const proofs=useMemo(()=>{const values=proofUrls?.length?proofUrls:proofUrl?[proofUrl]:[];return [...new Set(values.filter(Boolean))].slice(0,5);},[proofUrl,proofUrls]);
  const [failed,setFailed]=useState<Set<number>>(()=>new Set());
  const [open,setOpen]=useState<number|null>(null);

  useEffect(()=>{if(open===null)return;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(null);};window.addEventListener('keydown',onKey);return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',onKey);};},[open]);

  if(!proofs.length)return <p className="text-xs text-slate-500 lg:col-span-4">No screenshot attached.</p>;
  const selected=open===null?null:proofs[open];
  return <div className="lg:col-span-4">
    <div className={`grid gap-2 ${proofs.length===1?'max-w-sm grid-cols-1':'max-w-2xl grid-cols-2 sm:grid-cols-3'}`}>
      {proofs.map((proof,index)=>{const preview=proofDisplayHref(proof)!;return <button key={proof} type="button" onClick={()=>setOpen(index)} className="overflow-hidden rounded-xl border border-white/10 bg-black/20 text-left transition hover:border-orange-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300" aria-label={`Enlarge ${label} ${index+1}`}>
        {failed.has(index)?<p className="p-4 text-xs text-slate-400">Proof unavailable in this session.</p>:<div className={`relative ${compact?'h-28 sm:h-36':'h-40 sm:h-48'}`}><Image src={preview} alt={`${label} ${index+1}`} fill unoptimized referrerPolicy="no-referrer" loading="lazy" sizes="(max-width: 640px) 46vw, 240px" className="object-contain" onError={()=>setFailed(current=>new Set(current).add(index))}/></div>}
        <p className="border-t border-white/10 px-3 py-1.5 text-xs font-semibold text-orange-300">Proof {index+1} of {proofs.length} · Tap to enlarge</p>
      </button>;})}
    </div>
    {selected&&<div role="dialog" aria-modal="true" aria-label={`${label} ${open!+1}`} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={()=>setOpen(null)}><div className="relative flex h-full w-full max-w-6xl flex-col" onClick={event=>event.stopPropagation()}><div className="mb-3 flex items-center justify-between gap-3"><a href={proofDisplayHref(selected,true)!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-slate-950/80 px-4 text-sm font-bold text-orange-300 hover:bg-white/10"><ExternalLink className="h-4 w-4"/>Open original</a><span className="text-sm font-bold text-slate-300">{open!+1} / {proofs.length}</span><button type="button" onClick={()=>setOpen(null)} autoFocus aria-label="Close screenshot" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-slate-950/80 text-white hover:bg-white/10"><X className="h-5 w-5"/></button></div><div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-slate-950"><Image src={proofDisplayHref(selected)!} alt={`${label} ${open!+1}`} fill unoptimized referrerPolicy="no-referrer" sizes="100vw" className="object-contain"/></div></div></div>}
  </div>;
}
