import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestEmailPasswordReset } from '@/lib/email-password-reset';

const RequestSchema = z.object({ identifier: z.string().trim().min(1).max(254) });
const GENERIC_MESSAGE = 'If that account exists, a password reset link has been sent to the email address linked to it. Check your inbox and spam folder.';

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { identifier } = RequestSchema.parse(await request.json());
    const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || '';
    await requestEmailPasswordReset(identifier, origin);
  } catch (error) {
    // Keep the response generic so this endpoint cannot be used to enumerate accounts.
    console.error('Password reset request failed', error instanceof Error ? error.message : error);
  }
  const remaining = 450 - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  return NextResponse.json({ message: GENERIC_MESSAGE }, { headers: { 'Cache-Control': 'no-store' } });
}
