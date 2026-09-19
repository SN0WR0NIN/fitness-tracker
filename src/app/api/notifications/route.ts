import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/auth';
import { getUserNotifications } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAppSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json(await getUserNotifications(userId, 20), { headers: { 'Cache-Control': 'no-store' } });
}
