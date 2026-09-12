import {
  Ban,
  CheckCircle2,
  Image as ImageIcon,
  SlidersHorizontal,
  TriangleAlert,
  Upload,
} from "lucide-react";
import type { AdminOperationsAnalytics as Analytics } from "@/lib/admin-operations";
import type { ScheduledHealth } from "@/lib/system-automation";

const panel = "rounded-2xl border border-white/10 bg-white/[0.04] p-5";

export default function AdminOperationsAnalytics({
  analytics,
  health,
}: {
  analytics: Analytics;
  health: ScheduledHealth | null;
}) {
  const healthy = health?.status === "HEALTHY";
  return (
    <section
      aria-labelledby="operational-analytics-heading"
      className="space-y-4"
    >
      <div>
        <h2 id="operational-analytics-heading" className="text-xl font-black">
          Operational analytics
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Live read-only counts. Opening this view never changes activities or
          scores.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={<Upload className="h-5 w-5" />}
          label="Upload failures · 7 days"
          value={String(analytics.uploads.failuresSevenDays)}
          detail={
            analytics.uploads.latestFailureAt
              ? `Latest ${formatSg(analytics.uploads.latestFailureAt)}`
              : "No stored failures"
          }
          good={analytics.uploads.failuresSevenDays === 0}
        />
        <Metric
          icon={<ImageIcon className="h-5 w-5" />}
          label="Multi-proof activities"
          value={String(analytics.activity.multipleProofs)}
          detail={`${analytics.activity.singleProof} single · ${analytics.activity.noProof} without proof`}
          good={analytics.activity.proofMismatches === 0}
        />
        <Metric
          icon={<Ban className="h-5 w-5" />}
          label="Rejected activities"
          value={String(analytics.activity.rejected)}
          detail={`${analytics.activity.rejectedSevenDays} in the last 7 days`}
          good
        />
        <Metric
          icon={<SlidersHorizontal className="h-5 w-5" />}
          label="Active score overrides"
          value={String(analytics.activity.scoreOverrides)}
          detail="Persistent admin adjustments"
          good
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className={panel}>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-sky-300" />
            <h3 className="font-black">Proof storage</h3>
          </div>
          {analytics.storage ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Stat
                label="Stored objects"
                value={analytics.storage.storedObjects}
              />
              <Stat
                label="Unattached objects"
                value={analytics.storage.unattachedObjects}
              />
              <Stat
                label="Five-photo galleries"
                value={analytics.activity.maxedProofs}
              />
              <Stat
                label="Gallery mismatches"
                value={analytics.activity.proofMismatches}
              />
            </dl>
          ) : (
            <p className="mt-4 text-sm text-amber-200">
              Storage object counts are unavailable. Activity proof counts are
              still shown above.
            </p>
          )}
        </div>
        <div className={panel}>
          <div className="flex items-center gap-2">
            {healthy ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            ) : (
              <TriangleAlert className="h-5 w-5 text-amber-300" />
            )}
            <h3 className="font-black">Scheduled system health</h3>
          </div>
          <p
            className={`mt-4 text-2xl font-black ${healthy ? "text-emerald-300" : "text-amber-300"}`}
          >
            {health?.status ?? "UNAVAILABLE"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {health
              ? `Last checked ${formatSg(health.createdAt)} · ${health.details.score_mismatches} score mismatch${health.details.score_mismatches === 1 ? "" : "es"}`
              : "No scheduled result is available."}
          </p>
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
  good,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  good: boolean;
}) {
  return (
    <div
      className={`${panel} ${good ? "" : "border-amber-400/25 bg-amber-400/[0.07]"}`}
    >
      <span className={good ? "text-lime-300" : "text-amber-300"}>{icon}</span>
      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-black/15 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-black">{value}</dd>
    </div>
  );
}
function formatSg(value: Date) {
  return value.toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
