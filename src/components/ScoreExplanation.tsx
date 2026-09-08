import { explainScore, type ExplainedActivity } from '@/lib/score-explanation';

export default function ScoreExplanation({ activity, compact = false }: { activity: ExplainedActivity; compact?: boolean }) {
  const explanation = explainScore(activity);
  const statusTone = activity.status === 'APPROVED' ? 'text-emerald-300' : activity.status === 'REJECTED' ? 'text-rose-300' : 'text-amber-200';

  if (compact) {
    return <div data-testid="score-explanation" className="rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`font-semibold ${statusTone}`}>{explanation.status}</p>
        {explanation.breakdown ? <span className="font-black text-orange-300">{explanation.breakdown.totalPoints.toFixed(1)} pts</span> : null}
      </div>
      {explanation.breakdown ? <p className="mt-1 text-slate-400">Base {explanation.breakdown.basePoints.toFixed(2)} · Friend +{explanation.breakdown.friendBonus.toFixed(1)}</p> : <p className="mt-1">{explanation.message}</p>}
      {explanation.breakdown ? <p className="mt-2 border-t border-white/5 pt-2 text-slate-500">{explanation.message} Saved totals always round down to the lower whole point.</p> : null}
    </div>;
  }

  return <div data-testid="score-explanation" className="mt-2 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
    <p className={`font-semibold ${statusTone}`}>{explanation.status}</p>
    {explanation.breakdown ? <p>Activity points {explanation.breakdown.basePoints.toFixed(2)} · Friend bonus +{explanation.breakdown.friendBonus.toFixed(1)} · Saved total {explanation.breakdown.totalPoints.toFixed(1)}</p> : null}
    <p>{explanation.message}</p>
    {explanation.breakdown ? <p className="text-slate-500">Activity points are displayed to 2 decimals. The saved total always rounds down to the lower whole point.</p> : null}
  </div>;
}
