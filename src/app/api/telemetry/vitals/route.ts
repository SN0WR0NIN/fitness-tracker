import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const METRICS = new Set(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']);
const RATINGS = new Set(['good', 'needs-improvement', 'poor']);

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name : '';
    const value = typeof body.value === 'number' && Number.isFinite(body.value) ? body.value : null;
    const delta = typeof body.delta === 'number' && Number.isFinite(body.delta) ? body.delta : null;
    const rating = typeof body.rating === 'string' && RATINGS.has(body.rating) ? body.rating : 'unknown';
    const pathname = typeof body.pathname === 'string' && body.pathname.startsWith('/') ? body.pathname.slice(0, 160) : '/';
    const navigationType = typeof body.navigationType === 'string' ? body.navigationType.slice(0, 40) : 'unknown';
    const release = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local';
    const roundedValue = value === null ? null : Math.round(value * 1000) / 1000;
    const roundedDelta = delta === null ? null : Math.round(delta * 1000) / 1000;

    if (!METRICS.has(name) || roundedValue === null) {
      return NextResponse.json({ error: 'Invalid performance metric.' }, { status: 400 });
    }

    console.log(JSON.stringify({
      level: 'info',
      event: 'web_vital',
      metric: name,
      value: roundedValue,
      delta: roundedDelta,
      rating,
      pathname,
      navigationType,
      release,
    }));

    if (process.env.VERCEL_ENV === 'production') {
      await prisma.performanceMetric.create({
        data: {
          source: 'web_vital',
          route: pathname,
          metric: name,
          value: roundedValue,
          rating,
          release,
          navigationType,
          metadata: roundedDelta === null ? undefined : { delta: roundedDelta },
        },
      });
    }

    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'warning',
      event: 'web_vital_store_failed',
      error: error instanceof Error ? error.message : String(error),
    }));
    return NextResponse.json({ error: 'Invalid performance metric.' }, { status: 400 });
  }
}
