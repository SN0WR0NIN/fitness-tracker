import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { NewPasswordSchema, ContactEmailSchema, verifyCredentials } from '@/lib/account-credentials';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { username: true, email: true, pendingEmail: true, emailConfirmedAt: true } });
  return NextResponse.json(user);
}
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  try {
    const data = z.object({ currentPassword: z.string().max(72), newPassword: NewPasswordSchema.optional(), email: ContactEmailSchema }).parse(await request.json());
    const account = await prisma.user.findUnique({ where: { id: session.user.id } });
    const user = account ? await verifyCredentials(account.username ?? account.email, data.currentPassword) : null;
    if (!user || user.id !== session.user.id) return NextResponse.json({ error: 'Check your current password or try again after 15 minutes.' }, { status: 401 });
    const password = data.newPassword ? await bcrypt.hash(data.newPassword, 12) : undefined;
    const changed = await prisma.user.updateMany({ where: { id: user.id, password: user.password, sessionVersion: user.sessionVersion }, data: { pendingEmail: data.email === user.email ? null : data.email, ...(password ? { password, sessionVersion: { increment: 1 } } : {}), loginAttempts: 0 } });
    if (!changed.count) return NextResponse.json({ error: 'Account changed. Sign in again.' }, { status: 409 });
    return NextResponse.json({ passwordChanged: Boolean(password) });
  } catch { return NextResponse.json({ error: 'Use a real email and, if changing your password, 12–72 characters.' }, { status: 400 }); }
}
