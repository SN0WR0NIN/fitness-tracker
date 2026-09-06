import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NewPasswordSchema } from '@/lib/account-credentials';
import { completePasswordReset } from '@/lib/password-reset';

const ResetSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  temporaryPassword: z.string().min(1).max(72),
  newPassword: NewPasswordSchema,
});

export async function POST(request: Request) {
  try {
    const data = ResetSchema.parse(await request.json());
    await completePasswordReset(data.identifier, data.temporaryPassword, data.newPassword);
    return NextResponse.json({ message: 'Password reset complete. Log in with your new password.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'PASSWORD_REUSE') return NextResponse.json({ error: 'Choose a password different from the temporary reset password.' }, { status: 400 });
    return NextResponse.json({ error: 'The reset credentials are invalid, expired, or have already been used. Request another reset if needed.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
