import { after } from 'next/server';
import { prisma } from '@/lib/prisma';

const releaseId = () => process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local';
const shouldPersistPerformance = () => process.env.VERCEL_ENV === 'production';

function metricMetadata(extra: Record<string, unknown>) {
  const metadata: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (key === 'route') continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      metadata[key] = value as string | number | boolean | null;
    }
  }
  return metadata;
}

export function requestLog(request: Request, route: string) {
  const startedAt = Date.now();
  const requestId = request.headers.get('x-vercel-id') || request.headers.get('x-request-id') || 'local';
  console.log(JSON.stringify({ level: 'info', message: 'Request started', route, requestId }));
  return {
    success(extra: Record<string, unknown> = {}) {
      console.log(JSON.stringify({ level: 'info', message: 'Request completed', route, requestId, durationMs: Date.now() - startedAt, ...extra }));
    },
    failure(error: unknown, extra: Record<string, unknown> = {}) {
      console.error(JSON.stringify({ level: 'error', message: 'Request failed', route, requestId, durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error), ...extra }));
    },
  };
}

export function performanceLog(event: string, durationMs: number, extra: Record<string, unknown> = {}) {
  const roundedDuration = Math.round(durationMs * 10) / 10;
  const release = releaseId();
  console.log(JSON.stringify({
    level: 'info',
    event,
    durationMs: roundedDuration,
    release,
    ...extra,
  }));

  if (!shouldPersistPerformance()) return;
  const route = typeof extra.route === 'string' ? extra.route.slice(0, 160) : 'unknown';
  const metadata = metricMetadata(extra);

  try {
    after(async () => {
      try {
        await prisma.performanceMetric.create({
          data: {
            source: 'server_timing',
            route,
            metric: event.slice(0, 160),
            value: roundedDuration,
            release,
            metadata,
          },
        });
      } catch (error) {
        console.error(JSON.stringify({
          level: 'warning',
          event: 'performance_metric_store_failed',
          metric: event,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    });
  } catch {
    // Some non-request contexts do not expose Next.js after(). Logging still works there.
  }
}

export async function timed<T>(event: string, operation: () => Promise<T>, extra: Record<string, unknown> = {}): Promise<T> {
  const startedAt = Date.now();
  try {
    const value = await operation();
    performanceLog(event, Date.now() - startedAt, extra);
    return value;
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event,
      durationMs: Date.now() - startedAt,
      release: releaseId(),
      error: error instanceof Error ? error.message : String(error),
      ...extra,
    }));
    throw error;
  }
}
