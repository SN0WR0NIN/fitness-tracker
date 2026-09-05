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
  console.log(JSON.stringify({
    level: 'info',
    event,
    durationMs: Math.round(durationMs * 10) / 10,
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    ...extra,
  }));
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
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
      error: error instanceof Error ? error.message : String(error),
      ...extra,
    }));
    throw error;
  }
}
