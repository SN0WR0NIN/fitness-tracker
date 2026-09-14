'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function ChallengeCompletionRedirect(){
  const pathname=usePathname();const router=useRouter();
  useEffect(()=>{if(pathname!=='/')return;let cancelled=false;fetch('/api/config',{cache:'no-store'}).then(response=>response.json()).then(data=>{if(!cancelled&&data.phase==='COMPLETE')router.replace('/results?final=1');}).catch(()=>{});return()=>{cancelled=true;};},[pathname,router]);
  return null;
}
