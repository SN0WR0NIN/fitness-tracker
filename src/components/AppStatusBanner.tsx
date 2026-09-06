'use client';
import { useEffect,useState } from 'react';
import { Wrench } from 'lucide-react';
type PublicConfig={maintenanceMode?:boolean;readOnlyMode?:boolean;maintenanceMessage?:string};
export default function AppStatusBanner(){
  const [config,setConfig]=useState<PublicConfig|null>(null);
  useEffect(()=>{const controller=new AbortController();const load=()=>{if(document.visibilityState==='hidden')return;fetch('/api/config',{cache:'no-store',signal:controller.signal}).then((response)=>response.ok?response.json():null).then((data)=>{if(!controller.signal.aborted&&data)setConfig(data);}).catch(()=>{});};load();window.addEventListener('focus',load);window.addEventListener('kg:config-changed',load);const timer=window.setInterval(load,60000);return()=>{controller.abort();window.clearInterval(timer);window.removeEventListener('focus',load);window.removeEventListener('kg:config-changed',load);};},[]);
  if(!config?.maintenanceMode&&!config?.readOnlyMode)return null;
  return <div role="status" className="border-b border-amber-300/20 bg-amber-300/10 px-4 py-2.5 text-amber-950 dark:text-amber-100"><div className="mx-auto flex max-w-7xl items-start gap-3 text-sm"><Wrench className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"/><p><strong>{config.readOnlyMode?'Read-only competition:':'Submissions paused:'}</strong> {config.maintenanceMessage || 'Competition changes are temporarily paused.'} Results remain available to view.</p></div></div>;
}
