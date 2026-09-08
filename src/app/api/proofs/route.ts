import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { localProofFixtures, mayReadProof, resolveProofReference } from '@/lib/proof-access';
import { downloadProofImage } from '@/lib/storage';
import { verifiedImageMime } from '@/lib/image-upload';

export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store',
  'Vary': 'Cookie', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
const unavailable = (status: number) => NextResponse.json({ error: status === 401 ? 'Not authenticated' : 'Proof unavailable' }, { status, headers });

export async function GET(request: Request) {
  try {
    if (request.headers.get('sec-fetch-site') === 'cross-site') return unavailable(403);
    const session = await getServerSession(authOptions); // rechecks session version and current role
    if (!session?.user?.id) return unavailable(401);
    const url = new URL(request.url);
    const value = url.searchParams.get('ref') || '';
    const reference = resolveProofReference(value);
    if (!reference || !await mayReadProof(prisma, value, session.user.id, reference)) return unavailable(404);
    if (reference.kind === 'external') {
      // No server-side request is sent to a user-supplied external host.
      return new NextResponse(null, { status: 307, headers: { ...headers, Location: url.searchParams.get('original') === '1' ? reference.url : reference.preview } });
    }
    if (reference.kind === 'fixture') {
      if (!localProofFixtures()) return unavailable(404);
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6ioAAAAASUVORK5CYII=', 'base64');
      return new NextResponse(new Uint8Array(png), { headers: { ...headers, 'Content-Type': 'image/png' } });
    }
    // Serve through this authenticated, non-cacheable boundary. A reusable
    // bearer signed URL is never disclosed to the browser or image optimizer.
    const blob = await downloadProofImage(reference.path);
    if (blob.size > 4 * 1024 * 1024) return unavailable(413);
    const buffer = Buffer.from(await blob.arrayBuffer());
    const mime = verifiedImageMime(buffer, blob.type, ['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    if (!mime) return unavailable(415);
    return new NextResponse(new Uint8Array(buffer), { headers: { ...headers, 'Content-Type': mime, 'Content-Disposition': 'inline' } });
  } catch {
    // Never log a proof reference, provider response, credential, or image data.
    return unavailable(503);
  }
}
