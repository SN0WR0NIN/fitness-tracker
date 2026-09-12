import type { Activity } from "@prisma/client";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import AdminScoreOverrides from "@/components/AdminScoreOverrides";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import { getLatestScoreReviewNotes } from "@/lib/admin-control";

export const dynamic = "force-dynamic";

type ScoreOverrideActivity = Activity & {
  pointsLog: {
    basePoints: number;
    friendBonus: number;
    totalPoints: number;
  } | null;
  user: { id: string; name: string; email: string };
  column: { name: string };
};

export default async function AdminScoreOverridesPage() {
  const guard = await requireAdmin();
  if (guard.status === 401) redirect("/auth/login");
  if (guard.error) redirect("/dashboard");

  const [activitiesResult, reviewNotes] = await Promise.all([
    prisma.activity.findMany({
      include: {
        pointsLog: {
          select: { basePoints: true, friendBonus: true, totalPoints: true },
        },
        user: { select: { id: true, name: true, email: true } },
        column: { select: { name: true } },
      },
      orderBy: { occurredAt: "desc" },
    }),
    getLatestScoreReviewNotes(),
  ]);
  const activities = activitiesResult as ScoreOverrideActivity[];

  const serialized = activities.map((activity: ScoreOverrideActivity) => ({
    ...activity,
    occurredAt: activity.occurredAt.toISOString(),
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
    weekStart: activity.weekStart.toISOString(),
    reviewedAt: activity.reviewedAt?.toISOString() ?? null,
    reviewNote: reviewNotes.get(activity.id) ?? "",
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.2),_transparent_45%),rgba(255,255,255,0.04)] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">
            Admin scoring control
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-5xl">
            Score overrides
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Manually override Base Points and the final Points Total when an
            approved calculation needs an administrator adjustment. Overrides
            survive future score reconciliations until cleared.
          </p>
        </header>
        <div className="mt-6">
          <AdminScoreOverrides initialActivities={serialized} />
        </div>
      </main>
    </div>
  );
}
