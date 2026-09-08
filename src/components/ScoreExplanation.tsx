import { ChevronDown } from 'lucide-react';
import { explainScore, type ExplainedActivity } from '@/lib/score-explanation';

export default function ScoreExplanation({ activity }: { activity: ExplainedActivity }) {
  const explanation = explainScore(activity);
  return <details data-testid="score-explanation" className="group rounded-xl border border-white/10 bg-black/10">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:content-none">
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${activity.status === 'APPROVED' ? 'text-emerald-300' : 'text-amber-200'}`}>{explanation.status}</p>
        {explanation.breakdown ? <p className="mt-0.5 truncate text-xs text-slate-500">{explanation.breakdown.basePoints.toFixed(2)} activity + {explanation.breakdown.friendBonus.toFixed(1)} bonus = {explanation.breakdown.totalPoints.toFixed(1)} pts</p> : <p className="mt-0.5 truncate text-xs text-slate-500">Tap for score details</p>}
      </div>
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" />
    </summary>
    <div className="border-t border-white/5 px-3 pb-3 pt-2 text-xs leading-5 text-slate-400">
      {explanation.breakdown ? <p>Activity points {explanation.breakdown.basePoints.toFixed(2)} · Friend bonus +{explanation.breakdown.friendBonus.toFixed(1)} · Saved total {explanation.breakdown.totalPoints.toFixed(1)}</p> : null}
      <p>{explanation.message}</p>
      {explanation.breakdown ? <p className="text-slate-500">Activity points use 2 decimals. The saved total rounds up to the next 0.5 point.</p> : null}
    </div>
  </details>;
}
