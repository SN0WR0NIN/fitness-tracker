"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  Bike,
  ChevronDown,
  ExternalLink,
  Filter,
  Footprints,
  Images,
  Pencil,
  Search,
  Users,
  Waves,
} from "lucide-react";
import ActivityProof from "@/components/ActivityProof";
import ScoreExplanation from "@/components/ScoreExplanation";
import { proofDisplayHref } from "@/lib/proof-reference";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";
import type { ScoreBreakdown } from "@/lib/score-explanation";

type Category = "RUN" | "CYCLE" | "SWIM" | "WALK_OR_HIKE" | "TROOP_GAMES";
type Status = "PENDING" | "APPROVED" | "REJECTED";
type Item = {
  id: string;
  category: Category;
  distance: number;
  pace: number | null;
  duration: number | null;
  points: number;
  pointsLog?: ScoreBreakdown | null;
  completedWithFriend: boolean;
  companion: string | null;
  status: Status;
  rejectionReason: string | null;
  proofUrl: string | null;
  proofUrls: string[];
  occurredAt: string;
  stravaActivityId: string | null;
};

const labels: Record<Category, string> = {
  RUN: "Run",
  CYCLE: "Cycle",
  SWIM: "Swim",
  WALK_OR_HIKE: "Walk / Hike",
  TROOP_GAMES: "Troop Games",
};
const icons = {
  RUN: Footprints,
  CYCLE: Bike,
  SWIM: Waves,
  WALK_OR_HIKE: Activity,
  TROOP_GAMES: Users,
};
const proofsFor = (item: Item) =>
  item.proofUrls?.length
    ? item.proofUrls
    : item.proofUrl
      ? [item.proofUrl]
      : [];

export default function MyActivitiesHistory({
  activities,
}: {
  activities: Item[];
}) {
  const [status, setStatus] = useState<"ALL" | Status>("ALL");
  const [category, setCategory] = useState<"ALL" | Category>("ALL");
  const [query, setQuery] = useState("");
  const counts = useMemo(
    () => ({
      ALL: activities.length,
      PENDING: activities.filter((a) => a.status === "PENDING").length,
      APPROVED: activities.filter((a) => a.status === "APPROVED").length,
      REJECTED: activities.filter((a) => a.status === "REJECTED").length,
    }),
    [activities],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activities.filter(
      (a) =>
        (status === "ALL" || a.status === status) &&
        (category === "ALL" || a.category === category) &&
        (!q ||
          `${labels[a.category]} ${a.rejectionReason ?? ""} ${a.companion ?? ""}`
            .toLowerCase()
            .includes(q)),
    );
  }, [activities, status, category, query]);

  return (
    <>
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStatus(item)}
                  className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold ${status === item ? "bg-orange-500 text-white" : "bg-black/20 text-slate-400 hover:bg-white/5"}`}
                >
                  {item === "ALL"
                    ? "All"
                    : item[0] + item.slice(1).toLowerCase()}{" "}
                  <span className="ml-1 opacity-70">{counts[item]}</span>
                </button>
              ),
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search activity details"
                className="w-full rounded-xl border border-white/10 bg-slate-900 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-orange-400 sm:w-64"
              />
            </label>
            <label className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="w-full appearance-none rounded-xl border border-white/10 bg-slate-900 py-2.5 pl-9 pr-8 text-sm outline-none focus:border-orange-400"
              >
                <option value="ALL">All sports</option>
                {Object.entries(labels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {filtered.length ? (
          filtered.map((item) => {
            const Icon = icons[item.category];
            const proofs = proofsFor(item);
            const proof = proofDisplayHref(proofs[0]);
            return (
              <details
                key={item.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
              >
                <summary className="grid cursor-pointer list-none grid-cols-[4.75rem_1fr_auto] items-center gap-3 p-3 marker:content-none sm:grid-cols-[6rem_1fr_auto] sm:p-4">
                  <div className="relative h-16 w-full overflow-hidden rounded-xl border border-white/10 bg-black/20 sm:h-20">
                    {proof ? (
                      <>
                        <Image
                          src={proof}
                          alt={`${labels[item.category]} proof thumbnail`}
                          fill
                          unoptimized
                          sizes="96px"
                          className="object-cover"
                        />
                        {proofs.length > 1 ? (
                          <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[0.6rem] font-black">
                            +{proofs.length - 1}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <div className="grid h-full place-items-center text-slate-600">
                        <Icon className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{labels[item.category]}</p>
                      <StatusPill status={item.status} />
                      {proofs.length ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/15 bg-sky-400/[0.08] px-2 py-1 text-[0.65rem] font-black text-sky-200">
                          <Images className="h-3 w-3" />
                          {proofs.length} proof{proofs.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(item.occurredAt).toLocaleDateString("en-SG", {
                        timeZone: "Asia/Singapore",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {item.distance
                        ? ` · ${formatDistance(item.distance)}${item.category === "SWIM" ? "m" : "km"}`
                        : ""}
                      {item.duration
                        ? ` · ${formatDuration(item.duration)}`
                        : ""}
                      {item.pace ? ` · ${formatPace(item.pace)}/km` : ""}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-600">
                      {item.completedWithFriend
                        ? `With ${item.companion || "friends"}`
                        : "Solo activity"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-right font-black text-orange-300">
                      +{item.points.toFixed(1)}
                    </span>
                    <ChevronDown className="h-5 w-5 text-slate-500 transition group-open:rotate-180" />
                  </div>
                </summary>
                <div className="border-t border-white/5 p-4 sm:p-5">
                  {item.rejectionReason ? (
                    <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">
                      <strong>Rejection reason:</strong> {item.rejectionReason}
                    </div>
                  ) : null}
                  <ScoreExplanation activity={item} />
                  <div className="mt-4">
                    <ActivityProof
                      proofUrl={item.proofUrl}
                      proofUrls={item.proofUrls}
                      label={`${labels[item.category]} activity screenshot`}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                    {item.status === "APPROVED" ? (
                      <Link
                        href={`/activities/${item.id}/correction`}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-bold text-sky-200"
                      >
                        <Pencil className="h-4 w-4" />
                        Request correction
                      </Link>
                    ) : null}
                    {item.status === "PENDING" ? (
                      <Link
                        href={`/dashboard#activity-${item.id}`}
                        className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300"
                      >
                        Edit pending entry
                      </Link>
                    ) : null}
                    {item.stravaActivityId ? (
                      <a
                        href={`https://www.strava.com/activities/${item.stravaActivityId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-sm font-bold text-orange-200"
                      >
                        Open Strava <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </details>
            );
          })
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-12 text-center text-sm text-slate-500">
            No activities match these filters.
          </div>
        )}
      </section>
    </>
  );
}
function StatusPill({ status }: { status: Status }) {
  const style =
    status === "APPROVED"
      ? "bg-emerald-400/10 text-emerald-300"
      : status === "REJECTED"
        ? "bg-rose-400/10 text-rose-300"
        : "bg-amber-400/10 text-amber-300";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black ${style}`}
    >
      {status}
    </span>
  );
}
