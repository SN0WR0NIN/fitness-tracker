import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureAdminControlSchema } from '@/lib/admin-control';

export async function GET() {
  try {
    await ensureAdminControlSchema();
    const columns = await prisma.$queryRawUnsafe('SELECT "id", "name" FROM "Column" WHERE "isActive"=true ORDER BY "name" ASC');
    return NextResponse.json(columns);
  } catch (error) {
    console.error('Error fetching columns:', error);
    return NextResponse.json({ error: 'Failed to fetch columns' }, { status: 500 });
  }
}
