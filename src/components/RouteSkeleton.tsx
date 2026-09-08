export default function RouteSkeleton({ cards = 4, compact = false }: { cards?: number; compact?: boolean }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8 lg:py-12" aria-busy="true" aria-label="Loading page">
        <div className="animate-pulse rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <div className="h-3 w-28 rounded bg-white/10" />
          <div className="mt-4 h-9 w-64 max-w-full rounded bg-white/10" />
          <div className="mt-4 h-4 w-full max-w-xl rounded bg-white/5" />
        </div>
        <div className={`grid gap-4 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
          {Array.from({ length: cards }, (_, index) => (
            <div key={index} className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="h-5 w-5 rounded bg-white/10" />
              <div className="mt-5 h-3 w-24 rounded bg-white/10" />
              <div className="mt-3 h-7 w-20 rounded bg-white/10" />
              <div className="mt-3 h-3 w-full rounded bg-white/5" />
            </div>
          ))}
        </div>
        <div className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-16 rounded-xl bg-white/[0.05]" />)}
          </div>
        </div>
      </main>
    </div>
  );
}
