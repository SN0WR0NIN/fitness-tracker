import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { sendPasswordResetForUser } from '@/lib/password-reset';

const ActionSchema = z.object({
  userId: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const data = ActionSchema.parse(await request.json());
    await sendPasswordResetForUser(data.userId, guard.userId);
    return NextResponse.json({ message: 'Password reset email sent.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'RESET_EMAIL_UNAVAILABLE') return NextResponse.json({ error: 'Add a real email to this active account before sending a reset link.' }, { status: 409 });
    if (code === 'PASSWORD_RESET_EMAIL_NOT_CONFIGURED') return NextResponse.json({ error: 'Password reset email delivery is not configured.' }, { status: 503 });
    return NextResponse.json({ error: 'Unable to send this password reset email.' }, { status: 400 });
  }
}
