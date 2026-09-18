'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Activity, ChartNoAxesCombined, History, LayoutDashboard } from 'lucide-react';
import type { MetricActivity } from '@/lib/personal-metrics';
import type { ScoringRules } from '@/lib/scoring';
import WeekComparisonPanel from '@/components/WeekComparisonPanel';
import SeasonHistoryPanel from '@/components/SeasonHistoryPanel';

export type AnalyticsView = 'overview' | 'progress' | 'activities' | 'history';

type GoalHistory = {
  weekNumber:number;
  dateRange:string;
  points:number;
  target:number;
  achieved:boolean;
  current:boolean;
};

type WeeklyScore = {
  weekNumber:number;
  totalPoints:number;
};

type Props = {
  activities: MetricActivity[];
  today: string;
  scoringRules?: ScoringRules;
  name: string;
  columnName?: string | null;
  rank?: number | null;
  participantCount: number;
  weeklyGoal: number;
  weeklyScores: WeeklyScore[];
  goalHistory: GoalHistory[];
};

const PersonalAnalyticsContent = dynamic(() => import('@/components/PersonalAnalyticsContent'), {
  ssr: false,
  loading: () => <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"><div className="h-5 w-40 animate-pulse rounded bg-white/10" /><div className="mt-4 h-32 animate-pulse rounded-xl bg-white/5" /></div>,
});

const views: Array<{key:AnalyticsView;label:string;description:string;icon:React.ReactNode}> = [
  { key:'overview', label:'Overview', description:'Current snapshot', icon:<LayoutDashboard className="h-4 w-4"/> },
  { key:'progress', label:'Progress', description:'Trends & weeks', icon:<ChartNoAxesCombined className="h-4 w-4"/> },
  { key:'activities', label:'Activities', description:'Sports & bests', icon:<Activity className="h-4 w-4"/> },
  { key:'history', label:'History', description:'Past seasons', icon:<History className="h-4 w-4"/> },
];

export default function PersonalAnalytics(props: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AnalyticsView>('overview');

  return <details className="dashboard-fold profile-main-fold" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Performance analytics</summary>
    {open ? <div className="pt-3">
      <div role="tablist" aria-label="Performance analytics categories" className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/15 p-2 sm:grid-cols-4">
        {views.map(item => {
          const active=view===item.key;
          return <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={()=>setView(item.key)}
            className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${active?'border-lime-300/30 bg-lime-300/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(190,242,100,.05)]':'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.035] hover:text-slate-200'}`}
          >
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active?'bg-lime-300/10 text-lime-300':'bg-white/5 text-slate-500'}`}>{item.icon}</span>
            <span className="min-w-0"><span className="block text-sm font-black">{item.label}</span><span className="hidden truncate text-[0.65rem] text-slate-500 sm:block">{item.description}</span></span>
          </button>;
        })}
      </div>

      <div role="tabpanel" className="mt-4">
        {view==='history'
          ? <SeasonHistoryPanel embedded/>
          : <div className="space-y-4">
              <PersonalAnalyticsContent {...props} view={view}/>
              {view==='progress' ? <WeekComparisonPanel activities={props.activities} embedded/> : null}
            </div>}
      </div>
    </div> : null}
  </details>;
}
