import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Verifies the current session belongs to an ADMIN user, re-checking the role
 * fresh from the database (a cached JWT role could be stale if it changed
 * after login).
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return { error: 'Not authenticated' as const, status: 401 as const, userId: null };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'ADMIN') {
    return { error: 'Forbidden' as const, status: 403 as const, userId: null };
  }

  return { error: null, status: 200 as const, userId };
}
