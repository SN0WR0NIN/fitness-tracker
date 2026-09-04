import { redirect } from 'next/navigation';
import AdminControlCenter from '@/components/AdminControlCenter';
import { requireAdmin } from '@/lib/adminGuard';
import { getAnnouncements, getAuditEntries, getChallengeSettings, getManagedColumns } from '@/lib/admin-control';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const guard = await requireAdmin();
  if (guard.status === 401) redirect('/auth/login');
  if (guard.error) redirect('/dashboard');

  const [settings, announcements, audit, columns, users, activities, pending, approvedPoints, categories] = await Promise.all([
    getChallengeSettings(), getAnnouncements(), getAuditEntries(), getManagedColumns(),
    prisma.user.count(), prisma.activity.count(), prisma.activity.count({ where: { status: 'PENDING' } }),
    prisma.activity.aggregate({ where: { status: 'APPROVED' }, _sum: { points: true } }),
    prisma.activity.groupBy({ by: ['category'], _count: { _all: true }, where: { status: 'APPROVED' } }),
  ]);

  return <AdminControlCenter
    settings={{ ...settings, startDate: settings.startDate.toISOString(), endDate: settings.endDate.toISOString(), updatedAt: settings.updatedAt.toISOString() }}
    announcements={announcements.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))}
    audit={audit.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
    columns={columns}
    analytics={{ users, activities, pending, approvedPoints: approvedPoints._sum.points ?? 0, categories: categories.map((item: { category: string; _count: { _all: number } }) => ({ category: item.category, count: item._count._all })) }}
  />;
}
