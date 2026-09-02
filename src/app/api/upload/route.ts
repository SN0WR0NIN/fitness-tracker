import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ensureProofBucketExists, uploadProofImage } from '@/lib/storage';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB — stays under serverless function payload limits

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error uploading proof image:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
