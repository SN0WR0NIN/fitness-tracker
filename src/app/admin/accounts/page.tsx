import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/prisma';
import AdminAccounts from '@/components/AdminAccounts';
export const dynamic = 'force-dynamic';
export default async function AccountsPage() {
  const guard = await requireAdmin();
  if (guard.error) redirect('/auth/login');
  const [users, columns] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, columnId: true, username: true, pendingEmail: true, mustChangePassword: true, password: true, role: true }, orderBy: { name: 'asc' } }),
    prisma.column.findMany({ select: { id: true, name: true } }),
  ]);
  return <AdminAccounts users={users.map(({ password, ...user }: { password: string; id: string; name: string; columnId: string | null; username: string | null; pendingEmail: string | null; mustChangePassword: boolean; role: string }) => ({ ...user, canProvision: user.role === 'MEMBER' && (password === '!UNCLAIMED' || user.mustChangePassword) }))} columns={columns} />;
}
