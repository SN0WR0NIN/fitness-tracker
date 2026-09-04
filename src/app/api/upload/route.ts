import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ensureProofBucketExists, uploadProofImage } from '@/lib/storage';
import { getChallengeSettings } from '@/lib/admin-control';
import { requestLog } from '@/lib/telemetry';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB — stays under serverless function payload limits

export async function POST(request: NextRequest) {
  const log = requestLog(request, '/api/upload');
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      log.success({ status: 401 });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const settings = await getChallengeSettings();
    if (settings.maintenanceMode && session.user.role !== 'ADMIN') {
      log.success({ status: 503, maintenanceMode: true });
      return NextResponse.json({ error: settings.maintenanceMessage }, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use JPEG, PNG, WebP, or GIF.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large. Max 4MB.' }, { status: 400 });
    }

    await ensureProofBucketExists();

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.type.split('/')[1];
    const fileName = `${session.user.id}/${randomUUID()}.${extension}`;

    const url = await uploadProofImage(buffer, fileName, file.type);

    log.success({ status: 200, contentType: file.type, bytes: file.size });
    return NextResponse.json({ url });
  } catch (error) {
    log.failure(error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
