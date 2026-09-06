import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { getOperatingState } from '@/lib/operating-mode';

// This is a maintenance gate, NOT an authorization boundary. Each route still
// validates its own session/role. Read-only is also enforced by DB triggers.
// Reads, page rendering, authentication, account recovery and unlocking do not
// make extra DB calls here. Keep this limited to competition mutations.
export async function proxy(request: NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return NextResponse.next();
  try {
    const state = await getOperatingState();
    if (state.mode === 'NORMAL') return NextResponse.next();
    if (state.mode === 'READ_ONLY') return NextResponse.json({ error: state.message, code: 'COMPETITION_READ_ONLY' }, { status: 423, headers: { 'Cache-Control': 'no-store' } });
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const actor = typeof token?.id === 'string'
      ? await prisma.user.findUnique({ where: { id: token.id }, select: { role: true, sessionVersion: true, mustChangePassword: true } })
      : null;
    const isAdmin = actor?.role === 'ADMIN' && !actor.mustChangePassword && actor.sessionVersion === (token?.sessionVersion ?? 0);
    if (!isAdmin) return NextResponse.json({ error: state.message, code: 'SUBMISSIONS_PAUSED' }, { status: 423, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.next();
  } catch (error) {
    console.error('Maintenance gate unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to verify competition controls. Please try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export const config = {
  matcher: [
    '/api/activities/:path*', '/api/corrections/:path*', '/api/upload', '/api/strava/sync',
    '/api/admin/activities/:path*', '/api/admin/corrections/:path*', '/api/admin/import/:path*',
    '/api/admin/duplicates/:path*', '/api/admin/awards/:path*', '/api/admin/control', '/api/admin/users/:path*',
  ],
};
