"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  CheckCircle2,
  ImageOff,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import ProofGallery from "@/components/ProofGallery";

type ActivityStatus = "PENDING" | "APPROVED" | "REJECTED";
type ScoreActivity = {
  id: string;
  category: string;
  status: ActivityStatus;
  occurredAt: string;
  distance: number;
  pace: number | null;
  points: number;
  proofUrl: string | null;
  proofUrls: string[];
  basePointsOverride: number | null;
  totalPointsOverride: number | null;
  reviewNote: string;
  pointsLog: {
    basePoints: number;
    friendBonus: number;
    totalPoints: number;
  } | null;
  user: { id: string; name: string; email: string };
  column: { name: string };
};
type EditState = {
  id: string;
  baseEnabled: boolean;
  totalEnabled: boolean;
  base: string;
  total: string;
  note: string;
};
function formatDistance(activity: ScoreActivity) {
  if (!Number.isFinite(activity.distance) || activity.distance <= 0) return "—";
  if (activity.category === "SWIM") return `${Math.round(activity.distance)} m`;
  return `${activity.distance.toFixed(2)} km`;
}
function formatPace(pace: number | null) {
  if (pace === null || !Number.isFinite(pace) || pace <= 0) return "—";
  const totalSeconds = Math.round(pace * 60);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")} /km`;
}
function proofsFor(activity: ScoreActivity) {
  return activity.proofUrls?.length
    ? [...new Set(activity.proofUrls)]
    : activity.proofUrl
      ? [activity.proofUrl]
      : [];
}

export default function AdminScoreOverrides({
  initialActivities,
}: {
  initialActivities: ScoreActivity[];
}) {
  const [activities, setActivities] = useState(initialActivities);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | ActivityStatus>("APPROVED");
  const [proofFilter, setProofFilter] = useState<
    "ALL" | "MULTI" | "HAS" | "NONE"
  >("ALL");
  const [edit, setEdit] = useState<EditState | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activities
      .filter((a) => status === "ALL" || a.status === status)
      .filter((a) => {
        const count = proofsFor(a).length;
        if (proofFilter === "MULTI") return count > 1;
        if (proofFilter === "HAS") return count > 0;
        if (proofFilter === "NONE") return count === 0;
        return true;
      })
      .filter(
        (a) =>
          !q ||
          `${a.user.name} ${a.user.email} ${a.column.name} ${a.category}`
            .toLowerCase()
            .includes(q),
      )
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      );
  }, [activities, proofFilter, query, status]);
  const refresh = async () => {
    const response = await fetch("/api/admin/activities?status=ALL", {
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(data))
      throw new Error("Latest scores could not be loaded.");
    setActivities(data as ScoreActivity[]);
  };
  const start = (activity: ScoreActivity) => {
    if (!activity.pointsLog) return;
    setError("");
    setEdit({
      id: activity.id,
      baseEnabled: activity.basePointsOverride !== null,
      totalEnabled: activity.totalPointsOverride !== null,
      base: String(
        activity.basePointsOverride ?? activity.pointsLog.basePoints,
      ),
      total: String(
        activity.totalPointsOverride ?? activity.pointsLog.totalPoints,
      ),
      note: activity.reviewNote ?? "",
    });
  };
  const save = async (activity: ScoreActivity) => {
    if (!edit || edit.id !== activity.id) return;
    const base = Number(edit.base),
      total = Number(edit.total);
    if (edit.baseEnabled && (!Number.isFinite(base) || base < 0))
      return setError("Base points must be zero or greater.");
    if (
      edit.totalEnabled &&
      (!Number.isFinite(total) ||
        total < 0 ||
        Math.abs(total * 2 - Math.round(total * 2)) > 1e-9)
    )
      return setError(
        "Total points must be zero or greater and use 0.5-point increments.",
      );
    setSavingId(activity.id);
    setSavedId(null);
    setError("");
    try {
      const response = await fetch(`/api/admin/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basePointsOverride: edit.baseEnabled ? base : null,
          totalPointsOverride: edit.totalEnabled ? total : null,
          reviewNote: edit.note.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to save score override.",
        );
      await refresh();
      setEdit(null);
      setSavedId(activity.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save score override.",
      );
    } finally {
      setSavingId(null);
    }
  };
  const clear = async (activity: ScoreActivity) => {
    setSavingId(activity.id);
    setSavedId(null);
    setError("");
    try {
      const response = await fetch(`/api/admin/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basePointsOverride: null,
          totalPointsOverride: null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to clear score override.",
        );
      await refresh();
      setEdit(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to clear score override.",
      );
    } finally {
      setSavingId(null);
    }
  };
  const goToNext = (id: string) => {
    const current = filtered.findIndex((activity) => activity.id === id);
    const next = filtered[current + 1];
    if (!next) return;
    const target = document.querySelector<HTMLElement>(
      `[data-score-activity-id="${next.id}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    target?.focus({ preventScroll: true });
    setSavedId(null);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search athlete, email, column or sport"
              className="w-full rounded-xl border border-white/10 bg-slate-900 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-orange-400"
            />
          </label>
          <select
            aria-label="Filter score overrides by status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "ALL" | ActivityStatus)
            }
            className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-orange-400"
          >
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
            <option value="ALL">All</option>
          </select>
          <select
            aria-label="Filter score overrides by proof count"
            value={proofFilter}
            onChange={(event) =>
              setProofFilter(event.target.value as typeof proofFilter)
            }
            className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-orange-400"
          >
            <option value="ALL">All proof counts</option>
            <option value="MULTI">Multiple proofs</option>
            <option value="HAS">Has proof</option>
            <option value="NONE">No proof</option>
          </select>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          All attached proof photos, distance and pace are shown together for
          vetting. Base override replaces the calculated base points.
          Friend-bonus allocation stays automatic. A Total override, when
          enabled, becomes the exact final saved total and must use 0.5-point
          increments.
        </p>
        <p className="mt-2 text-xs font-bold text-slate-400">
          Showing {filtered.length} of {activities.length} activities
        </p>
      </section>
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200"
        >
          {error}
        </div>
      ) : null}
      <section className="space-y-3">
        {filtered.map((activity, index) => {
          const log = activity.pointsLog,
            isEditing = edit?.id === activity.id,
            overridden =
              activity.basePointsOverride !== null ||
              activity.totalPointsOverride !== null,
            proofs = proofsFor(activity);
          const hasNext = index < filtered.length - 1;
          return (
            <article
              key={activity.id}
              data-score-activity-id={activity.id}
              tabIndex={-1}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
            >
              <div className="grid sm:grid-cols-[12rem_1fr]">
                <div className="border-b border-white/10 bg-black/20 p-2 sm:border-b-0 sm:border-r">
                  {proofs.length ? (
                    <ProofGallery
                      proofs={proofs}
                      label={`${activity.user.name}'s proof`}
                      compact
                      actionVerb="View"
                    />
                  ) : (
                    <div className="flex h-full min-h-36 flex-col items-center justify-center gap-2 px-4 text-center text-slate-600">
                      <ImageOff className="h-6 w-6" />
                      <span className="text-xs font-bold">No photo proof</span>
                    </div>
                  )}
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/participants/${activity.user.id}`}
                          className="font-black hover:text-orange-300"
                        >
                          {activity.user.name}
                        </Link>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[0.68rem] font-black text-slate-400">
                          {activity.status}
                        </span>
                        {overridden ? (
                          <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2 py-0.5 text-[0.68rem] font-black text-orange-200">
                            ADMIN OVERRIDE
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {activity.column.name} · {activity.category} ·{" "}
                        {new Date(activity.occurredAt).toLocaleDateString(
                          "en-SG",
                          {
                            timeZone: "Asia/Singapore",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        )}{" "}
                        · {proofs.length} proof{proofs.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-orange-300">
                        {activity.points.toFixed(1)}
                      </p>
                      <p className="text-[0.68rem] uppercase tracking-wider text-slate-600">
                        saved total
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/5 bg-black/10 p-3 text-center text-xs sm:grid-cols-5">
                    <div>
                      <p className="text-slate-500">Distance</p>
                      <p className="mt-1 font-black" data-vetting-distance>
                        {formatDistance(activity)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Pace</p>
                      <p className="mt-1 font-black" data-vetting-pace>
                        {formatPace(activity.pace)}
                      </p>
                    </div>
                    {log ? (
                      <>
                        <div>
                          <p className="text-slate-500">Base</p>
                          <p className="mt-1 font-black">
                            {log.basePoints.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Friend</p>
                          <p className="mt-1 font-black">
                            +{log.friendBonus.toFixed(1)}
                          </p>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <p className="text-slate-500">Total</p>
                          <p className="mt-1 font-black">
                            {log.totalPoints.toFixed(1)}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-2 text-amber-200 sm:col-span-3">
                        Score breakdown unavailable.
                      </div>
                    )}
                  </div>
                  {activity.reviewNote ? (
                    <div className="mt-3 rounded-xl border border-sky-400/15 bg-sky-400/[0.06] p-3 text-sm text-sky-100">
                      <p className="text-[0.68rem] font-black uppercase tracking-wider text-sky-300">
                        Admin review note
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {activity.reviewNote}
                      </p>
                    </div>
                  ) : null}
                  {savedId === activity.id ? (
                    <div
                      role="status"
                      className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-3 text-sm text-emerald-100"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-bold">Review saved.</span>
                      {hasNext ? (
                        <button
                          type="button"
                          onClick={() => goToNext(activity.id)}
                          className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2 font-black text-emerald-950"
                        >
                          Next activity <ArrowDown className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="ml-auto text-xs text-emerald-300">
                          End of filtered list
                        </span>
                      )}
                    </div>
                  ) : null}
                  {isEditing && log ? (
                    <div className="mt-4 grid gap-4 rounded-xl border border-orange-400/20 bg-orange-400/[0.06] p-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="flex items-center gap-2 text-sm font-bold">
                          <input
                            type="checkbox"
                            checked={edit.baseEnabled}
                            onChange={(event) =>
                              setEdit({
                                ...edit,
                                baseEnabled: event.target.checked,
                              })
                            }
                          />
                          Override Base Points
                        </span>
                        <input
                          aria-label="Base Points override"
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!edit.baseEnabled}
                          value={edit.base}
                          onChange={(event) =>
                            setEdit({ ...edit, base: event.target.value })
                          }
                          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 disabled:opacity-50"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="flex items-center gap-2 text-sm font-bold">
                          <input
                            type="checkbox"
                            checked={edit.totalEnabled}
                            onChange={(event) =>
                              setEdit({
                                ...edit,
                                totalEnabled: event.target.checked,
                              })
                            }
                          />
                          Override Points Total
                        </span>
                        <input
                          aria-label="Points Total override"
                          type="number"
                          min="0"
                          step="0.5"
                          disabled={!edit.totalEnabled}
                          value={edit.total}
                          onChange={(event) =>
                            setEdit({ ...edit, total: event.target.value })
                          }
                          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 disabled:opacity-50"
                        />
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-bold">
                          Optional review note
                        </span>
                        <textarea
                          aria-label="Admin review note"
                          maxLength={500}
                          rows={3}
                          value={edit.note}
                          onChange={(event) =>
                            setEdit({ ...edit, note: event.target.value })
                          }
                          placeholder="Record why this score was adjusted or confirmed. Admins only."
                          className="w-full resize-y rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                        />
                        <span className="block text-right text-xs text-slate-500">
                          {edit.note.length} / 500
                        </span>
                      </label>
                      <div className="flex flex-wrap gap-2 md:col-span-2">
                        <button
                          type="button"
                          disabled={savingId === activity.id}
                          onClick={() => save(activity)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-black disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          Save score
                        </button>
                        <button
                          type="button"
                          disabled={savingId === activity.id}
                          onClick={() => clear(activity)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold disabled:opacity-50"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Use calculated score
                        </button>
                        <button
                          type="button"
                          onClick={() => setEdit(null)}
                          className="min-h-10 rounded-xl px-4 py-2 text-sm font-bold text-slate-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={!log || savingId !== null}
                        onClick={() => start(activity)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-sm font-black text-orange-200 disabled:opacity-50"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        Edit score
                      </button>
                      {overridden ? (
                        <button
                          type="button"
                          disabled={savingId !== null}
                          onClick={() => clear(activity)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold disabled:opacity-50"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Clear overrides
                        </button>
                      ) : null}
                      {hasNext ? (
                        <button
                          type="button"
                          onClick={() => goToNext(activity.id)}
                          className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300"
                        >
                          Next activity <ArrowDown className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {!filtered.length ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
            No matching activities.
          </div>
        ) : null}
      </section>
    </div>
  );
}
