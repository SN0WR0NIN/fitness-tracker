import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ensureProfileBucketExists, uploadProfileImage } from '@/lib/storage';
import { requestLog } from '@/lib/telemetry';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const log = requestLog(request, '/api/profile/photo');
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a profile photo.' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Use a JPEG, PNG, or WebP image.' }, { status: 400 });
    if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: 'Profile photo must be 2 MB or smaller.' }, { status: 400 });

    await ensureProfileBucketExists();
    const url = await uploadProfileImage(Buffer.from(await file.arrayBuffer()), userId, file.type);
    log.success({ status: 200, contentType: file.type, bytes: file.size });
    return NextResponse.json({ url });
  } catch (error) {
    log.failure(error);
    return NextResponse.json({ error: 'Failed to upload profile photo.' }, { status: 500 });
  }
}
