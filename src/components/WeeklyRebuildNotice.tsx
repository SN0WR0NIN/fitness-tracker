import { prisma } from '@/lib/prisma';
export default async function WeeklyRebuildNotice(){
  const rows=await prisma.$queryRaw<Array<{season_key:string;week_number:number;reason:string}>>`SELECT season_key,week_number,reason FROM app_internal.weekly_result_dirty ORDER BY season_key,week_number`;
  if(!rows.length)return null;
  return <section role="status" className="rounded-2xl border border-amber-300/30 bg-amber-300/5 p-5"><h2 className="font-black text-amber-200">Finalized results need rebuilding</h2><p className="mt-2 text-sm text-slate-300">Approved activity data changed after these snapshots were published. Review the changes, clear any pending activities, then rebuild the affected week below. Rebuilding updates its published standings and awards.</p><div className="mt-3 space-y-2">{rows.map((row)=><p key={`${row.season_key}:${row.week_number}`} className="text-sm text-amber-100">Week {row.week_number} · season {row.season_key}: {row.reason}</p>)}</div></section>;
}
