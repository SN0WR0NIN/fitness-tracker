import { explainScore, type ExplainedActivity } from '@/lib/score-explanation';
import { DEFAULT_SCORING_RULES, type ScoringRules } from '@/lib/scoring';

export default function ScoreExplanation({ activity, compact = false, scoringRules = DEFAULT_SCORING_RULES }: { activity: ExplainedActivity; compact?: boolean; scoringRules?: ScoringRules }) {
  const explanation = explainScore(activity, scoringRules);
  const statusTone = activity.status === 'APPROVED' ? 'text-emerald-300' : activity.status === 'REJECTED' ? 'text-rose-300' : 'text-amber-200';
  const roundingNote = explanation.overridden
    ? 'An administrator has manually set part or all of this score.'
    : 'Saved totals always round down to the lower 0.5-point increment.';

  const breakdown = explanation.breakdown ? (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric label="Distance points" value={explanation.breakdown.distancePoints.toFixed(1)} />
      <Metric label="Pace points" value={explanation.breakdown.pacePoints.toFixed(1)} />
      <Metric label="Friend bonus" value={`+${explanation.breakdown.friendBonus.toFixed(1)}`} />
      <Metric label="Total Points" value={explanation.breakdown.totalPoints.toFixed(1)} highlight />
    </div>
  ) : null;

  const calculation = explanation.breakdown ? (
    <details className="mt-3 rounded-lg border border-white/5 bg-black/10 px-3 py-2">
      <summary className="cursor-pointer select-none font-bold text-slate-300 marker:text-slate-500">How was this calculated?</summary>
      <div className="mt-2 space-y-1.5 text-slate-400">
        {explanation.calculation.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
        <p className="border-t border-white/5 pt-2 text-slate-500">{explanation.message} {roundingNote}</p>
      </div>
    </details>
  ) : null;

  if (compact) {
    return <div data-testid="score-explanation" className="rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`font-semibold ${statusTone}`}>{explanation.status}</p>
        {explanation.breakdown ? <span className="font-black text-orange-300">{explanation.breakdown.totalPoints.toFixed(1)} pts</span> : null}
      </div>
      {explanation.breakdown ? breakdown : <p className="mt-1">{explanation.message}</p>}
      {calculation}
    </div>;
  }

  return <div data-testid="score-explanation" className="mt-2 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
    <p className={`font-semibold ${statusTone}`}>{explanation.status}</p>
    {explanation.breakdown ? breakdown : <p className="mt-1">{explanation.message}</p>}
    {calculation}
  </div>;
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className="rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2">
    <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-0.5 font-black ${highlight ? 'text-orange-300' : 'text-slate-200'}`}>{value}</p>
  </div>;
}
