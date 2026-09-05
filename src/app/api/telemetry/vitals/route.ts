import { NextResponse } from 'next/server';

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
    const id = typeof body.id === 'string' ? body.id.slice(0, 80) : 'unknown';

    if (!METRICS.has(name) || value === null) {
      return NextResponse.json({ error: 'Invalid performance metric.' }, { status: 400 });
    }

    console.log(JSON.stringify({
      level: 'info',
      event: 'web_vital',
      metric: name,
      value: Math.round(value * 1000) / 1000,
      delta: delta === null ? null : Math.round(delta * 1000) / 1000,
      rating,
      pathname,
      navigationType,
      metricId: id,
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    }));

    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Invalid performance metric.' }, { status: 400 });
  }
}
