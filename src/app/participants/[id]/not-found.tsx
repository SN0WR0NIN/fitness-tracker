import Link from 'next/link';
import { SearchX } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function ParticipantNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-28 text-center">
        <span className="rounded-3xl bg-white/5 p-5 text-slate-500"><SearchX className="h-12 w-12" /></span>
        <h1 className="mt-6 text-3xl font-black">Participant not found</h1>
        <p className="mt-3 text-slate-400">This profile may no longer be available.</p>
        <Link href="/leaderboard" className="mt-8 rounded-xl bg-orange-500 px-5 py-3 font-bold transition hover:bg-orange-400">Return to leaderboard</Link>
      </main>
    </div>
  );
}
