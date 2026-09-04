import Navbar from '@/components/Navbar';

export default function AdminActivitiesLoading() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl animate-pulse space-y-5 px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-28 rounded-3xl bg-white/5" />
        <div className="h-16 rounded-2xl bg-white/5" />
        <div className="h-64 rounded-2xl bg-white/5" />
        <div className="h-64 rounded-2xl bg-white/5" />
      </main>
    </div>
  );
}
