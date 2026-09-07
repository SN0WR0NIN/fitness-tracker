import { explainScore, type ExplainedActivity } from '@/lib/score-explanation';
export default function ScoreExplanation({ activity }: { activity: ExplainedActivity }) {
  const explanation = explainScore(activity);
  return <div data-testid="score-explanation" className="mt-2 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
    <p className={activity.status === 'APPROVED' ? 'font-semibold text-emerald-300' : 'font-semibold text-amber-200'}>{explanation.status}</p>
    {explanation.breakdown ? <p>Activity points {explanation.breakdown.basePoints.toFixed(2)} · Friend bonus +{explanation.breakdown.friendBonus.toFixed(1)} · Saved total {explanation.breakdown.totalPoints.toFixed(1)}</p> : null}
    <p>{explanation.message}</p>
    {explanation.breakdown ? <p className="text-slate-500">Activity points are displayed to 2 decimals. The saved total is rounded up to the next 0.5 point.</p> : null}
  </div>;
}
