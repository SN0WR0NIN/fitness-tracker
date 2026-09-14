import { redirect } from 'next/navigation';
import Navbar from '@/components/Navbar';
import WeekFinalizationManager from '@/components/WeekFinalizationManager';
import { requireAdmin } from '@/lib/adminGuard';

export const dynamic='force-dynamic';
export default async function AdminWeeksPage(){const guard=await requireAdmin();if(guard.status===401)redirect('/auth/login');if(guard.error)redirect('/dashboard');return <div className="min-h-screen bg-slate-950 text-white"><Navbar/><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"><WeekFinalizationManager/></main></div>;}
