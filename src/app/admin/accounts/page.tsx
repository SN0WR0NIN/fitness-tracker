import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/prisma';
import AdminAccounts from '@/components/AdminAccounts';
import { ContactEmailSchema } from '@/lib/account-credentials';
export const dynamic = 'force-dynamic';
export default async function AccountsPage() {
  const guard = await requireAdmin();
  if (guard.error) redirect('/auth/login');
  const [users, columns] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, emailConfirmedAt: true, columnId: true, username: true, pendingEmail: true, mustChangePassword: true, password: true, role: true, temporaryPasswordExpiresAt: true }, orderBy: { name: 'asc' } }),
    prisma.column.findMany({ select: { id: true, name: true } }),
  ]);
  return <AdminAccounts users={users.map(({ password, ...user }: { password: string; id: string; name: string; email: string; emailConfirmedAt: Date | null; columnId: string | null; username: string | null; pendingEmail: string | null; mustChangePassword: boolean; role: string; temporaryPasswordExpiresAt: Date | null }) => ({ ...user, emailConfirmedAt: user.emailConfirmedAt?.toISOString() ?? null, temporaryPasswordExpiresAt: user.temporaryPasswordExpiresAt?.toISOString() ?? null, unclaimed: password === '!UNCLAIMED', canProvision: user.role === 'MEMBER' && (password === '!UNCLAIMED' || user.mustChangePassword), canResetPassword: password !== '!UNCLAIMED' && ContactEmailSchema.safeParse(user.email).success }))} columns={columns} />;
}
