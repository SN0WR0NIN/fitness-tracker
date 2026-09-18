export function GET() {
  return Response.json({ error: 'This app now uses Clerk authentication.' }, { status: 410 });
}

export const POST = GET;
