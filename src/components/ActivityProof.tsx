'use client';
import Image from 'next/image';
import { useState } from 'react';

export default function ActivityProof({proofUrl,label}:{proofUrl:string|null;label:string}) {
  const [failed,setFailed]=useState(false);
  if (!proofUrl) return <p className="text-xs text-slate-500 lg:col-span-4">No screenshot attached.</p>;
  let preview=proofUrl;
  let valid=true;
  try {
    const url=new URL(proofUrl);
    if (!['https:','http:'].includes(url.protocol)) valid=false;
    if (url.hostname==='drive.google.com') {
      const id=url.searchParams.get('id') || url.pathname.match(/\/d\/([^/]+)/)?.[1];
      if(id) preview=`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w800`;
    }
  } catch { valid=false; }
  if (!valid) return <p className="text-xs text-slate-500 lg:col-span-4">Screenshot link unavailable.</p>;
  return <div className="lg:col-span-4"><a href={proofUrl} target="_blank" rel="noopener noreferrer" className="block max-w-sm overflow-hidden rounded-xl border border-white/10 bg-black/20 transition hover:border-orange-300/50 focus-visible:ring-2 focus-visible:ring-orange-300" aria-label={`Open ${label} in a new tab`}>
    {failed ? <p className="p-5 text-sm text-slate-400">Preview unavailable. Open the original screenshot.</p> : <div className="relative h-60 sm:h-72"><Image src={preview} alt={label} fill unoptimized sizes="(max-width: 640px) 100vw, 384px" className="object-contain" onError={()=>setFailed(true)} /></div>}
    <p className="border-t border-white/10 px-4 py-2 text-xs font-semibold text-orange-300">Open full screenshot ↗</p>
  </a></div>;
}
