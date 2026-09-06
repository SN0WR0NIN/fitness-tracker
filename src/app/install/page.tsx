import Link from 'next/link';
import Navbar from '@/components/Navbar';
import InstallAppPanel from '@/components/InstallAppPanel';
export default function InstallPage(){return <div className="min-h-screen bg-slate-950 text-white"><Navbar/><main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6"><Link href="/dashboard" className="font-bold text-lime-300">← Dashboard</Link><h1 className="text-3xl font-black">Install KG Active</h1><InstallAppPanel/></main></div>;}
