import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Lists participants (excluding the caller) for the activity friend picker.
 * A column assignment determines participation; admins can compete too.
 */
export async function GET() {
  try {
    const session = await getAppSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      where: { id: { not: session.user.id }, columnId: { not: null } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
