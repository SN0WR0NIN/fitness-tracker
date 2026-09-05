'use client';

import dynamic from 'next/dynamic';

type Week = { weekNumber: number; dateRange: string; points: number; target: number; achieved: boolean; current: boolean };

const WeeklyProgressChartContent = dynamic(() => import('@/components/WeeklyProgressChartContent'), {
  ssr: false,
  loading: () => <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"><div className="h-5 w-48 animate-pulse rounded bg-white/10" /><div className="mt-4 h-48 animate-pulse rounded-xl bg-white/5" /></div>,
});

export default function WeeklyProgressChart({ weeks }: { weeks: Week[] }) {
  return <WeeklyProgressChartContent weeks={weeks} />;
}
