import Link from 'next/link';
import { ChevronRight, Pencil } from 'lucide-react';

// Kept as a compatibility component for existing dashboard callers. Approved
// dates and other scoring fields now use the reviewed correction workflow.
export default function ApprovedActivityDateEditor({ activity }: { activity: { id: string; occurredAt: string } }) {
  return <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3 lg:col-span-4">
    <Link href={`/activities/${encodeURIComponent(activity.id)}/correction`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-sky-300/20 bg-sky-400/[0.06] px-3 text-xs font-bold text-sky-200"><Pencil className="h-3.5 w-3.5" />Request correction</Link>
    <Link href="/corrections" className="inline-flex min-h-10 items-center gap-1 px-2 text-xs font-bold text-slate-500 transition hover:text-slate-300">Correction history <ChevronRight className="h-3.5 w-3.5" /></Link>
  </div>;
}
