import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import NewActivityForm from '@/components/NewActivityForm';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getChallengeSettings } from '@/lib/admin-control';

export const dynamic = 'force-dynamic';

type SelectableUser = { id: string; name: string };

export default async function NewActivityPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) redirect('/auth/login');

  const [usersResult, settings] = await Promise.all([
    prisma.user.findMany({ where: { id: { not: userId } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    getChallengeSettings(),
  ]);
  const users = usersResult as SelectableUser[];

  return <NewActivityForm users={users} scoringRules={settings.scoringRules} />;
}
