import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getAppSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { username: true, email: true, pendingEmail: true, emailConfirmedAt: true } });
  return NextResponse.json(user);
}
export async function POST() {
  const session = await getAppSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  return NextResponse.json(
    { error: 'Email and password changes are now managed by the shared Clerk account page.' },
    { status: 410 },
  );
}
