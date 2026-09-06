import Link from 'next/link';
import {
  Award,
  ChevronDown,
  DatabaseBackup,
  FileClock,
  KeyRound,
  Megaphone,
  PlusCircle,
  Settings,
  ShieldAlert,
  Trophy,
  Users,
} from 'lucide-react';

type WeeklyAwardState = 'FINALIZED' | 'READY' | 'WAITING_REVIEW' | 'NOT_STARTED';

type AdminActionHubProps = {
  pendingReviews: number;
  passwordResets: number;
  duplicateReviews: number;
  latestCompletedWeek: number;
  latestWeekPendingReviews: number;
  weeklyAwardState: WeeklyAwardState;
  healthStatus: string | null;
};

type ActionBadge = {
  label: string;
  tone?: 'neutral' | 'good' | 'warn' | 'danger';
};

type ActionItem = {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: ActionBadge;
};

export default function AdminActionHub({
  pendingReviews,
  passwordResets,
  duplicateReviews,
  latestCompletedWeek,
  latestWeekPendingReviews,
  weeklyAwardState,
  healthStatus,
}: AdminActionHubProps) {
  const attentionItems: Array<{ href: string; label: string }> = [];
  if (pendingReviews > 0) attentionItems.push({ href: '/admin/activities', label: `${pendingReviews} activit${pendingReviews === 1 ? 'y' : 'ies'} waiting for review` });
  if (passwordResets > 0) attentionItems.push({ href: '/admin/password-resets', label: `${passwordResets} password reset request${passwordResets === 1 ? '' : 's'}` });
  if (duplicateReviews > 0) attentionItems.push({ href: '/admin/duplicates', label: `${duplicateReviews} possible duplicate${duplicateReviews === 1 ? '' : 's'} to review` });
  if (weeklyAwardState === 'READY') attentionItems.push({ href: '/admin/awards', label: `Week ${latestCompletedWeek} results are ready to finalize` });
  if (weeklyAwardState === 'WAITING_REVIEW' && latestWeekPendingReviews > 0) attentionItems.push({ href: '/admin/activities', label: `Week ${latestCompletedWeek} awards are waiting on ${latestWeekPendingReviews} review${latestWeekPendingReviews === 1 ? '' : 's'}` });
  if (healthStatus && healthStatus !== 'HEALTHY') attentionItems.push({ href: '#system-health', label: `System health needs attention (${healthStatus})` });

  const activities: ActionItem[] = [
    { href: '/admin/activities/new', label: 'Create activity', description: 'Add an activity on behalf of a participant.', icon: <PlusCircle className="h-5 w-5" /> },
    { href: '/admin/activities', label: 'Review pending', description: 'Approve, reject or correct submitted activities.', icon: <FileClock className="h-5 w-5" />, badge: { label: pendingReviews ? String(pendingReviews) : 'Clear', tone: pendingReviews ? 'warn' : 'good' } },
    { href: '/admin/duplicates', label: 'Duplicate review', description: 'Compare possible duplicate entries side by side.', icon: <ShieldAlert className="h-5 w-5" />, badge: { label: duplicateReviews ? String(duplicateReviews) : 'Clear', tone: duplicateReviews ? 'warn' : 'good' } },
  ];

  const people: ActionItem[] = [
    { href: '/admin/users', label: 'Manage users', description: 'Manage participants, columns and account access.', icon: <Users className="h-5 w-5" /> },
    { href: '/admin/password-resets', label: 'Password resets', description: 'Handle participant forgot-password requests.', icon: <KeyRound className="h-5 w-5" />, badge: { label: passwordResets ? String(passwordResets) : 'None', tone: passwordResets ? 'warn' : 'good' } },
  ];

  const awardBadge: ActionBadge = weeklyAwardState === 'FINALIZED'
    ? { label: `Week ${latestCompletedWeek} finalized`, tone: 'good' }
    : weeklyAwardState === 'READY'
      ? { label: 'Ready', tone: 'warn' }
      : weeklyAwardState === 'WAITING_REVIEW'
        ? { label: `${latestWeekPendingReviews} review${latestWeekPendingReviews === 1 ? '' : 's'} left`, tone: 'warn' }
        : { label: 'Not started', tone: 'neutral' };

  const competition: ActionItem[] = [
    { href: '/admin/awards', label: 'Weekly awards', description: 'Finalize or rebuild weekly competition results.', icon: <Award className="h-5 w-5" />, badge: awardBadge },
    { href: '/admin/recap', label: 'Weekly recap', description: 'Generate the weekly challenge summary.', icon: <Megaphone className="h-5 w-5" /> },
    { href: '/results', label: 'Public results', description: 'Open the participant-facing weekly results page.', icon: <Trophy className="h-5 w-5" /> },
  ];

  const system: ActionItem[] = [
    { href: '/admin/settings', label: 'Settings & scoring', description: 'Challenge dates, maintenance mode and scoring rules.', icon: <Settings className="h-5 w-5" /> },
    { href: '/api/admin/export?type=backup', label: 'Fresh backup now', description: 'Create and download a fresh operational backup.', icon: <DatabaseBackup className="h-5 w-5" /> },
    { href: '/api/admin/backups/latest', label: 'Download auto backup', description: 'Download the latest scheduled operational snapshot.', icon: <DatabaseBackup className="h-5 w-5" /> },
  ];

  return (
    <section aria-label="Admin tools" className="space-y-4">
      {attentionItems.length ? (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] p-4 sm:p-5">
          <div className="flex items-center gap-2 text-amber-200">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <h2 className="font-black">Attention required</h2>
            <span className="ml-auto rounded-full bg-amber-300/15 px-2.5 py-1 text-xs font-black text-amber-200">{attentionItems.length}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {attentionItems.map((item) => (
              <Link key={`${item.href}-${item.label}`} href={item.href} className="rounded-xl border border-amber-300/15 bg-black/15 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-200/40 hover:bg-amber-300/10">
                {item.label} →
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="text-lg font-black">Admin tools</h2>
        <p className="mt-1 text-sm text-slate-500">Open only the section you need. Sections with work waiting are expanded automatically.</p>
      </div>

      <ToolGroup title="Activities" subtitle="Create, review and validate activity entries." items={activities} defaultOpen={pendingReviews > 0 || duplicateReviews > 0 || (passwordResets === 0 && weeklyAwardState !== 'READY')} />
      <ToolGroup title="People & access" subtitle="Participant accounts and password recovery." items={people} defaultOpen={passwordResets > 0} />
      <ToolGroup title="Competition" subtitle="Weekly awards, recap and published results." items={competition} defaultOpen={weeklyAwardState === 'READY' || weeklyAwardState === 'WAITING_REVIEW'} />
      <ToolGroup title="System" subtitle="Challenge configuration and operational backups." items={system} defaultOpen={false} />
    </section>
  );
}

function ToolGroup({ title, subtitle, items, defaultOpen }: { title: string; subtitle: string; items: ActionItem[]; defaultOpen: boolean }) {
  const attentionCount = items.filter((item) => item.badge && ['warn', 'danger'].includes(item.badge.tone ?? 'neutral')).length;
  return (
    <details open={defaultOpen} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 marker:content-none sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black">{title}</h3>
            {attentionCount ? <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-wide text-amber-200">{attentionCount} needs attention</span> : null}
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">{subtitle}</p>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 border-t border-white/5 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        {items.map((item) => <ActionCard key={item.href} item={item} />)}
      </div>
    </details>
  );
}

function ActionCard({ item }: { item: ActionItem }) {
  return (
    <Link href={item.href} className="group/card rounded-xl border border-white/10 bg-black/10 p-4 transition hover:border-lime-300/30 hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <span className="text-lime-300">{item.icon}</span>
        {item.badge ? <Badge badge={item.badge} /> : null}
      </div>
      <p className="mt-4 text-sm font-black group-hover/card:text-lime-200">{item.label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
    </Link>
  );
}

function Badge({ badge }: { badge: ActionBadge }) {
  const tone = badge.tone ?? 'neutral';
  const classes = tone === 'good'
    ? 'border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-200'
    : tone === 'warn'
      ? 'border-amber-400/20 bg-amber-400/[0.09] text-amber-200'
      : tone === 'danger'
        ? 'border-rose-400/20 bg-rose-400/[0.09] text-rose-200'
        : 'border-white/10 bg-white/[0.04] text-slate-400';
  return <span className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-black ${classes}`}>{badge.label}</span>;
}
