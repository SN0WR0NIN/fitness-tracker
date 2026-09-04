import Navbar from '@/components/Navbar';

export default function NewActivityLoading() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl animate-pulse px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-8 w-36 rounded-lg bg-white/5" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="h-[42rem] rounded-3xl bg-white/5" />
          <div className="h-72 rounded-3xl bg-white/5" />
        </div>
      </main>
    </div>
  );
}
