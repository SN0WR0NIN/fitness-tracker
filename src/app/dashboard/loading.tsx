import Navbar from '@/components/Navbar';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl animate-pulse space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-64 rounded-3xl bg-white/5" />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="h-80 rounded-2xl bg-white/5" />
          <div className="h-80 rounded-2xl bg-white/5" />
        </div>
        <div className="h-96 rounded-2xl bg-white/5" />
      </main>
    </div>
  );
}
