import { NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/prisma';
import { UsernameSchema } from '@/lib/account-credentials';

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const data = z.object({ userId: z.string().optional(), name: z.string().trim().min(2).max(120), columnId: z.string().min(1), username: UsernameSchema }).parse(await request.json());
    if (!await prisma.column.findUnique({ where: { id: data.columnId } })) return NextResponse.json({ error: 'Choose an existing column.' }, { status: 400 });
    const temporaryPassword = randomBytes(18).toString('base64url');
    const password = await bcrypt.hash(temporaryPassword, 12);
    const temporaryPasswordExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const credentials = { username: data.username, password, mustChangePassword: true, temporaryPasswordExpiresAt, loginAttempts: 0, loginWindowStartedAt: null };
    if (data.userId) {
      const changed = await prisma.user.updateMany({ where: { id: data.userId, role: 'MEMBER', OR: [{ password: '!UNCLAIMED' }, { mustChangePassword: true }] }, data: { ...credentials, sessionVersion: { increment: 1 } } });
      if (!changed.count) return NextResponse.json({ error: 'Only unclaimed or not-yet-activated member accounts can receive temporary credentials here.' }, { status: 409 });
    } else {
      await prisma.user.create({ data: { ...credentials, name: data.name, columnId: data.columnId, email: `account-${randomUUID()}@participants.invalid` } });
    }
    return NextResponse.json({ username: data.username, temporaryPassword, expiresAt: temporaryPasswordExpiresAt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Could not create credentials. Check the fields and choose a unique username.' }, { status: 409 }); }
}
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const data = z.object({ userId: z.string(), pendingEmail: z.string().email(), approve: z.boolean() }).parse(await request.json());
    if (data.approve) {
      const conflict = await prisma.user.findFirst({ where: { id: { not: data.userId }, email: { equals: data.pendingEmail, mode: 'insensitive' } }, select: { id: true } });
      if (conflict) return NextResponse.json({ error: 'That email is already assigned to another account.' }, { status: 409 });
    }
    const result = await prisma.user.updateMany({ where: { id: data.userId, pendingEmail: data.pendingEmail, mustChangePassword: false }, data: data.approve ? { email: data.pendingEmail, pendingEmail: null, emailConfirmedAt: new Date() } : { pendingEmail: null } });
    if (!result.count) return NextResponse.json({ error: 'The request changed. Refresh the page.' }, { status: 409 });
    return NextResponse.json({ saved: true });
  } catch { return NextResponse.json({ error: 'Could not process the email request.' }, { status: 409 }); }
}
