import { getAppSession } from '@/lib/auth';

export async function GET() {
  const session = await getAppSession();
  return Response.json(session, {
    status: session ? 200 : 401,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
