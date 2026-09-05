import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/prisma';
import HistoricalImport from '@/components/HistoricalImport';

export const dynamic = 'force-dynamic';
export default async function ImportPage() {
  const guard = await requireAdmin();
  if (guard.error) redirect(guard.status === 401 ? '/auth/login' : '/dashboard');
  const [users, columns] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, password: true }, orderBy: { name: 'asc' } }),
    prisma.column.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  return <HistoricalImport users={users.map(({ password, ...user }: { password: string; id: string; name: string; email: string }) => ({ ...user, unclaimed: password === '!UNCLAIMED' }))} columns={columns} />;
}
