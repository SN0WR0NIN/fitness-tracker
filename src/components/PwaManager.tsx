'use client';
import { createContext,useCallback,useContext,useEffect,useMemo,useRef,useState } from 'react';
import { WifiOff } from 'lucide-react';

type InstallPromptEvent=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
type PwaInstallContextValue={canInstall:boolean;showIOSInstructions:boolean;installed:boolean;install:()=>Promise<void>;installMessage:string;updateAvailable:boolean;applyUpdate:()=>void};
const PwaInstallContext=createContext<PwaInstallContextValue>({canInstall:false,showIOSInstructions:false,installed:false,install:async()=>{},installMessage:'',updateAvailable:false,applyUpdate:()=>{}});
export function usePwaInstall(){return useContext(PwaInstallContext);}

export default function PwaManager({children}:{children:React.ReactNode}){
  const [online,setOnline]=useState(true);const [installEvent,setInstallEvent]=useState<InstallPromptEvent|null>(null);
  const [showIOSInstructions,setShowIOSInstructions]=useState(false);const [installed,setInstalled]=useState(false);const [installMessage,setInstallMessage]=useState('');
  const [waiting,setWaiting]=useState<ServiceWorker|null>(null);const updateChosen=useRef(false);
  useEffect(()=>{
    let disposed=false;
    const display=window.matchMedia('(display-mode: standalone)');
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    const detectInstalled=()=>{const standalone=display.matches||Boolean((navigator as Navigator & {standalone?:boolean}).standalone);setInstalled(standalone);setShowIOSInstructions(ios&&!standalone);};
    queueMicrotask(()=>{if(!disposed){setOnline(navigator.onLine);detectInstalled();}});
    const onOnline=()=>setOnline(true);const onOffline=()=>setOnline(false);
    const onPrompt=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallPromptEvent);};
    const onInstalled=()=>{setInstalled(true);setInstallEvent(null);setShowIOSInstructions(false);setInstallMessage('KG Active is installed on this device.');};
    const onControllerChange=()=>{if(updateChosen.current)window.location.reload();};
    let registration:ServiceWorkerRegistration|undefined;
    const observe=()=>{const worker=registration?.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(!disposed&&worker.state==='installed'&&navigator.serviceWorker.controller)setWaiting(registration?.waiting ?? worker);});};
    const timer='serviceWorker' in navigator?window.setTimeout(()=>{
      navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then((result)=>{if(disposed)return;registration=result;if(result.waiting)setWaiting(result.waiting);result.addEventListener('updatefound',observe);observe();}).catch(()=>{if(!disposed)setInstallMessage('Offline support could not be enabled. You can continue using the website.');});
    },1600):null;
    window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);window.addEventListener('beforeinstallprompt',onPrompt);window.addEventListener('appinstalled',onInstalled);display.addEventListener('change',detectInstalled);
    if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('controllerchange',onControllerChange);
    return ()=>{disposed=true;if(timer!==null)window.clearTimeout(timer);registration?.removeEventListener('updatefound',observe);window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);window.removeEventListener('beforeinstallprompt',onPrompt);window.removeEventListener('appinstalled',onInstalled);display.removeEventListener('change',detectInstalled);if('serviceWorker' in navigator)navigator.serviceWorker.removeEventListener('controllerchange',onControllerChange);};
  },[]);
  const install=useCallback(async()=>{
    if(!installEvent)return;
    const event=installEvent;setInstallEvent(null);setInstallMessage('');
    try{await event.prompt();const choice=await event.userChoice;setInstallMessage(choice.outcome==='accepted'?'Installation accepted. Look for KG Active on this device.':'Installation dismissed. You can still install from your browser menu.');}catch{setInstallMessage('The install prompt is unavailable. Use your browser menu to install or add to Home Screen.');}
  },[installEvent]);
  const applyUpdate=useCallback(()=>{
    if(!waiting)return;
    if(!window.confirm('Reload KG Active to install the update? Finish any unsaved forms first. Saved activity drafts remain on this device.'))return;
    updateChosen.current=true;waiting.postMessage({type:'SKIP_WAITING'});
  },[waiting]);
  const value=useMemo(()=>({canInstall:Boolean(installEvent)&&!installed,showIOSInstructions,installed,install,installMessage,updateAvailable:Boolean(waiting),applyUpdate}),[installEvent,installed,showIOSInstructions,install,installMessage,waiting,applyUpdate]);
  return <PwaInstallContext.Provider value={value}>
    {waiting?<div role="status" className="flex flex-wrap items-center justify-center gap-3 border-b border-sky-300/20 bg-slate-900 px-4 py-2 text-sm text-sky-100"><span>An app update is ready. Finish your work before reloading.</span><button type="button" onClick={applyUpdate} className="min-h-11 rounded-lg border border-sky-300/30 px-3 font-bold">Update and reload</button></div>:null}
    {children}
    {!online?<div role="status" className="fixed inset-x-3 bottom-24 z-[70] mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-amber-300/20 bg-slate-900/95 px-4 py-3 text-sm text-amber-100 shadow-2xl"><WifiOff className="h-5 w-5 shrink-0"/><span><strong>Offline.</strong> Saved drafts stay on this device. Submissions and account changes require a connection.</span></div>:null}
  </PwaInstallContext.Provider>;
}
