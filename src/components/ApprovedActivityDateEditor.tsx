import Link from 'next/link';
import { Pencil } from 'lucide-react';

// Kept as a compatibility component for existing dashboard callers. Approved
// dates and other scoring fields now use the reviewed correction workflow.
export default function ApprovedActivityDateEditor({ activity }: { activity: { id: string; occurredAt: string } }) {
  return <div className="flex flex-wrap items-center gap-3 lg:col-span-4"><Link href={`/activities/${encodeURIComponent(activity.id)}/correction`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-sky-300/30 px-4 text-sm font-bold text-sky-200"><Pencil className="h-4 w-4" />Request correction</Link><Link href="/corrections" className="inline-flex min-h-11 items-center text-xs font-bold text-slate-400">My correction requests →</Link></div>;
}
