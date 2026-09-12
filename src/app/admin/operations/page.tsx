import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, DatabaseBackup, ShieldCheck, BellRing } from "lucide-react";
import Navbar from "@/components/Navbar";
import AdminOperationsAnalytics from "@/components/AdminOperationsAnalytics";
import { requireAdmin } from "@/lib/adminGuard";
import { getAdminOperationsAnalytics } from "@/lib/admin-operations";
import {
  getLatestOperationalBackupSummary,
  getLatestScheduledHealth,
} from "@/lib/system-automation";
import { getProofBucketPrivacy } from "@/lib/storage";

export const dynamic = "force-dynamic";
const panel = "rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6";
export default async function OperationsPage() {
  const guard = await requireAdmin();
  if (guard.status === 401) redirect("/auth/login");
  if (guard.error) redirect("/dashboard");
  const [privateProofs, snapshot, analytics, health] = await Promise.all([
    getProofBucketPrivacy(),
    getLatestOperationalBackupSummary().catch(() => null),
    getAdminOperationsAnalytics(),
    getLatestScheduledHealth().catch(() => null),
  ]);
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
        <Link href="/admin" className="text-sm font-bold text-lime-300">
          ← Command Centre
        </Link>
        <header className={panel}>
          <BookOpen className="h-7 w-7 text-orange-300" />
          <h1 className="mt-3 text-3xl font-black">Operations & analytics</h1>
          <p className="mt-3 text-slate-400">
            Live read-only health, proof, upload and review indicators plus the
            administrator handover guide. Opening this page does not change
            storage, spending limits, scores, or backups.
          </p>
        </header>
        <AdminOperationsAnalytics analytics={analytics} health={health} />
        <section
          className="grid gap-4 md:grid-cols-3"
          aria-label="Operational readiness"
        >
          <div className={panel}>
            <ShieldCheck className="text-lime-300" />
            <h2 className="mt-3 font-bold">Activity proofs</h2>
            <p className="mt-2 text-sm text-slate-300">
              {privateProofs === true
                ? "Supabase proof bucket is private."
                : privateProofs === false
                  ? "Action required: proof bucket is still public."
                  : "Bucket status unavailable — not verified."}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              App access is owner/admin only. External Drive or Strava copies
              and previously cached images have separate privacy controls.
              Profile photos are unchanged.
            </p>
          </div>
          <div className={panel}>
            <DatabaseBackup className="text-sky-300" />
            <h2 className="mt-3 font-bold">Recovery coverage</h2>
            <p className="mt-2 text-sm text-slate-300">
              {snapshot
                ? `Latest stored snapshot: version ${snapshot.version}, ${snapshot.createdAt.toLocaleString("en-SG", { timeZone: "Asia/Singapore" })} Singapore.`
                : "No stored snapshot metadata available."}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Fresh exports include PointsLog in v7. Scheduled snapshots need
              the approved v7 migration. JSON does not include image bytes;
              metadata alone is not a restore test.
            </p>
          </div>
          <div className={panel}>
            <BellRing className="text-amber-300" />
            <h2 className="mt-3 font-bold">Billing alerts</h2>
            <p className="mt-2 text-sm text-amber-200">
              Provider configuration not verified.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              The team owner chooses the USD threshold in Vercel Billing and
              verifies notification recipients. This app does not enable alerts
              or change billing.
            </p>
            <a
              className="mt-3 inline-block text-xs font-bold text-sky-300"
              href="https://vercel.com/docs/spend-management"
              target="_blank"
              rel="noreferrer"
            >
              Vercel setup instructions ↗
            </a>
          </div>
        </section>
        <details open className={panel}>
          <summary className="cursor-pointer font-black">
            Daily administrator checklist
          </summary>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <p>
              Review real submissions in Activities. Confirm the athlete,
              Singapore date, sport, evidence and duplicate warnings before
              approving or rejecting. Pending and rejected entries do not enter
              standings.
            </p>
            <p>
              Use Correction requests for disputed approved entries. Compare
              original and proposed values and record the decision reason. Do
              not change challenge rules to repair one entry.
            </p>
            <p>
              Watch Attention required for dirty finalized weeks. Finish
              relevant reviews, then rebuild the affected completed week in
              Weekly awards. Do not finalize an ongoing week.
            </p>
            <p>
              Use Recalculate all scores only for an explicitly planned
              historical rule correction with a verified backup. A timeout is
              not proof of rollback: inspect the audit log and stored scores
              before retrying.
            </p>
          </div>
        </details>
        <details className={panel}>
          <summary className="cursor-pointer font-black">
            Proof access and participant support
          </summary>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <p>
              Owners and administrators can open proof screenshots. Other
              participants and signed-out visitors cannot. Unattached uploads
              are visible to their uploader; an admin-created activity belongs
              to the selected participant.
            </p>
            <p>
              If an image fails, check the current login and provider
              availability. Never make a private bucket public as a quick fix,
              ask for passwords, or paste protected image links into public
              issue reports.
            </p>
            <p>
              Google Drive and Strava image links remain controlled by those
              providers. Ask the owner to restrict sharing or re-upload approved
              evidence; this app cannot revoke an external copy or a previously
              downloaded image.
            </p>
          </div>
        </details>
        <details className={panel}>
          <summary className="cursor-pointer font-black">
            Incident and recovery handover
          </summary>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <p>
              Record the release, Singapore timestamp, route and a redacted
              error. Separate UI trouble, data inconsistency, provider outage
              and accidental disclosure. Preserve evidence; do not repeatedly
              recalculate, restore or toggle permissions.
            </p>
            <p>
              Identify the on-duty app admin, GitHub/Vercel owner, Supabase
              owner and the separate backup custodian. Keep credentials in the
              approved private vault, not this guide.
            </p>
            <p>
              Before recovery, agree the acceptable data-loss window and
              recovery-time target. Verify JSON and media manifests, then
              rehearse in a new isolated environment. The supplied restore drill
              accepts only synthetic localhost CI data and refuses a non-empty
              target.
            </p>
            <p>
              The closing backup must follow committed score/result changes in a
              separate transaction. An old application deployment is not a
              database restore. Escalate production restore, media rotation,
              migrations and billing changes to the owner.
            </p>
          </div>
        </details>
        <p className="px-1 text-xs leading-5 text-slate-500">
          Release checklist and recovery commands are in
          PRIVACY_RECOVERY_RELEASE.md, RECOVERY_HARDENING.md, BILLING_ALERTS.md
          and ADMIN_HANDOVER.md in the repository. This page is a guide, not a
          security certification or a claim that all provider settings are
          activated.
        </p>
      </main>
    </div>
  );
}
