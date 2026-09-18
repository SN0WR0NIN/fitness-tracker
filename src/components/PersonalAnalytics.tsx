'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { MetricActivity } from '@/lib/personal-metrics';
import type { ScoringRules } from '@/lib/scoring';
import WeekComparisonPanel from '@/components/WeekComparisonPanel';
import SeasonRecordsPanel from '@/components/SeasonRecordsPanel';
import SeasonHistoryPanel from '@/components/SeasonHistoryPanel';

type Props = { activities: MetricActivity[]; today: string; scoringRules?: ScoringRules; weeklyChart?: React.ReactNode };

const PersonalAnalyticsContent = dynamic(() => import('@/components/PersonalAnalyticsContent'), {
  ssr: false,
  loading: () => <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"><div className="h-5 w-40 animate-pulse rounded bg-white/10" /><div className="mt-4 h-32 animate-pulse rounded-xl bg-white/5" /></div>,
});

export default function PersonalAnalytics(props: Props) {
  const [open, setOpen] = useState(false);
  return <details className="dashboard-fold profile-main-fold" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Performance analytics</summary>
    {open ? <div className="space-y-6 pt-3"><SeasonHistoryPanel/><WeekComparisonPanel activities={props.activities}/><SeasonRecordsPanel/><PersonalAnalyticsContent {...props} /></div> : null}
  </details>;
}
