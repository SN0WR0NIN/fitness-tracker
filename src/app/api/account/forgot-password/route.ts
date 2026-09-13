import { after, NextResponse } from 'next/server';
import { ContactEmailSchema } from '@/lib/account-credentials';
import { requestPasswordReset } from '@/lib/password-reset';

const GENERIC_MESSAGE = 'If an account exists for that email, we sent a password reset link. Check your inbox and spam folder. The link expires in 60 minutes.';

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const body = await request.json() as { email?: unknown };
    const email = ContactEmailSchema.parse(body.email);
    after(async () => {
      try {
        await requestPasswordReset(email);
      } catch {
        // Delivery failures are recorded as cancelled requests. Keep the public response generic.
      }
    });
  } catch {
    // Keep the response generic so this endpoint cannot be used to enumerate accounts.
  }
  const remaining = 450 - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  return NextResponse.json({ message: GENERIC_MESSAGE }, { headers: { 'Cache-Control': 'no-store' } });
}
