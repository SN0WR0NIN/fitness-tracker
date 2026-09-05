import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyCredentials, NewPasswordSchema, ContactEmailSchema } from '@/lib/account-credentials';

export async function POST(request: Request) {
  try {
    const data = z.object({ identifier: z.string().max(254), currentPassword: z.string().max(72), newPassword: NewPasswordSchema, email: ContactEmailSchema }).parse(await request.json());
    const user = await verifyCredentials(data.identifier, data.currentPassword);
    if (!user?.mustChangePassword) return NextResponse.json({ error: 'Check your temporary credentials. They may have expired or reached the attempt limit; contact your admin.' }, { status: 401 });
    if (await bcrypt.compare(data.newPassword, user.password)) return NextResponse.json({ error: 'Choose a password different from your temporary password.' }, { status: 400 });
    const password = await bcrypt.hash(data.newPassword, 12);
    const changed = await prisma.user.updateMany({ where: { id: user.id, password: user.password, mustChangePassword: true, temporaryPasswordExpiresAt: { gt: new Date() } }, data: { password, pendingEmail: data.email, mustChangePassword: false, temporaryPasswordExpiresAt: null, sessionVersion: { increment: 1 }, loginAttempts: 0 } });
    if (!changed.count) return NextResponse.json({ error: 'Credentials changed. Contact your admin or sign in again.' }, { status: 409 });
    return NextResponse.json({ message: 'Setup complete. Log in with your username and new password. Your email awaits admin confirmation.' });
  } catch { return NextResponse.json({ error: 'Unable to complete setup. Use a real email and a new password of 12–72 characters, then retry.' }, { status: 400 }); }
}
