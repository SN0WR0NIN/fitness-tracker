import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { getLatestOperationalBackupPayload } from '@/lib/system-automation';

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const latest = await getLatestOperationalBackupPayload();
  if (!latest) return NextResponse.json({ error: 'No automated backup is available yet.' }, { status: 404 });

  const date = latest.createdAt.toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(latest.payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="kg-auto-backup-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
