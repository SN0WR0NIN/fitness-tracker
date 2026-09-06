import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { cancelPasswordReset, issuePasswordReset } from '@/lib/password-reset';

const ActionSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['ISSUE','CANCEL']),
});

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const data = ActionSchema.parse(await request.json());
    if (data.action === 'CANCEL') {
      await cancelPasswordReset(data.requestId, guard.userId);
      return NextResponse.json({ saved: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const credentials = await issuePasswordReset(data.requestId, guard.userId);
    return NextResponse.json(credentials, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'RESET_REQUEST_CHANGED') return NextResponse.json({ error: 'This reset request changed. Refresh and try again.' }, { status: 409 });
    return NextResponse.json({ error: 'Unable to process this password reset request.' }, { status: 400 });
  }
}
