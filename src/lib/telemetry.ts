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
