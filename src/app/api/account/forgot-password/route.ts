import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset } from '@/lib/password-reset';

const RequestSchema = z.object({ identifier: z.string().trim().min(1).max(254) });
const GENERIC_MESSAGE = 'If that login matches an active participant account, your reset request has been sent to an admin. Ask the admin for the temporary reset password, then use the reset-password page.';

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { identifier } = RequestSchema.parse(await request.json());
    await requestPasswordReset(identifier);
  } catch {
    // Keep the response generic so this endpoint cannot be used to enumerate accounts.
  }
  const remaining = 450 - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  return NextResponse.json({ message: GENERIC_MESSAGE }, { headers: { 'Cache-Control': 'no-store' } });
}
