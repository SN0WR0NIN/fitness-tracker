import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NewPasswordSchema } from '@/lib/account-credentials';
import { completeEmailPasswordReset } from '@/lib/email-password-reset';

const ResetSchema = z.object({
  token: z.string().trim().min(20).max(4096),
  newPassword: NewPasswordSchema,
});

export async function POST(request: Request) {
  try {
    const data = ResetSchema.parse(await request.json());
    await completeEmailPasswordReset(data.token, data.newPassword);
    return NextResponse.json(
      { message: 'Password reset complete. Log in with your new password.' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'PASSWORD_REUSE') {
      return NextResponse.json({ error: 'Choose a password different from your current password.' }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'This reset link is invalid, expired, or has already been used. Request another reset email.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
