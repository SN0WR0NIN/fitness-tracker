import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NewPasswordSchema } from '@/lib/account-credentials';
import { completePasswordReset, validatePasswordResetToken } from '@/lib/password-reset';

const ResetSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  newPassword: NewPasswordSchema,
});

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const valid = await validatePasswordResetToken(token);
  return NextResponse.json(
    { valid },
    { status: valid ? 200 : 400, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  try {
    const data = ResetSchema.parse(await request.json());
    await completePasswordReset(data.token, data.newPassword);
    return NextResponse.json({ message: 'Password reset complete. Log in with your new password.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'PASSWORD_REUSE') return NextResponse.json({ error: 'Choose a password different from your current password.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ error: 'This reset link is invalid, expired, or has already been used. Request another link if needed.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
