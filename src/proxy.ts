import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOperatingState } from '@/lib/operating-mode';
import { clerkConfigured, clerkPublishableKey, clerkSecretKey } from '@/lib/clerk';

const isCompetitionMutation = createRouteMatcher([
  '/api/activities(.*)', '/api/corrections(.*)', '/api/upload', '/api/strava/sync',
  '/api/admin/activities(.*)', '/api/admin/corrections(.*)', '/api/admin/import(.*)',
  '/api/admin/duplicates(.*)', '/api/admin/awards(.*)', '/api/admin/control', '/api/admin/users(.*)',
]);

const protectedProxy = clerkMiddleware(async (authentication, request) => {
  if (!isCompetitionMutation(request) || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return NextResponse.next();
  }

  try {
    const state = await getOperatingState();
    if (state.mode === 'NORMAL') return NextResponse.next();
    if (state.mode === 'READ_ONLY') {
      return NextResponse.json({ error: state.message, code: 'COMPETITION_READ_ONLY' }, { status: 423, headers: { 'Cache-Control': 'no-store' } });
    }

    const { userId: clerkUserId } = await authentication();
    const actor = clerkUserId
      ? await prisma.user.findUnique({ where: { clerkUserId }, select: { role: true } })
      : null;
    if (actor?.role !== 'ADMIN') {
      return NextResponse.json({ error: state.message, code: 'SUBMISSIONS_PAUSED' }, { status: 423, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.next();
  } catch (error) {
    console.error('Maintenance gate unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to verify competition controls. Please try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}, {
  publishableKey: clerkPublishableKey,
  secretKey: clerkSecretKey,
  signInUrl: '/auth/login',
});

export default clerkConfigured ? protectedProxy : () => NextResponse.next();

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
