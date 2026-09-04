import { NextResponse } from 'next/server';
import { getAnnouncements } from '@/lib/admin-control';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const announcements = await getAnnouncements(true);
    return NextResponse.json(announcements.slice(0, 3));
  } catch (error) {
    console.error('Unable to load announcements:', error);
    return NextResponse.json([]);
  }
}
