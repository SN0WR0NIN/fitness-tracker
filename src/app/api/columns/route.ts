import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const columns = await prisma.column.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(columns);
  } catch (error) {
    console.error('Error fetching columns:', error);
    return NextResponse.json({ error: 'Failed to fetch columns' }, { status: 500 });
  }
}
