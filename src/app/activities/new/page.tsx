import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import EnhancedActivityForm from '@/components/EnhancedActivityForm';
import { authOptions } from '@/lib/auth';
import { getChallengeSettings } from '@/lib/admin-control';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function NewActivityPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) redirect('/auth/login');

  const [settings, recentActivities] = await Promise.all([
    getChallengeSettings(),
    prisma.activity.findMany({
      where: { userId },
      orderBy: { occurredAt: 'desc' },
      take: 30,
      select: { category: true, distance: true, pace: true, occurredAt: true, status: true },
    }),
  ]);
  const last = recentActivities.find((activity) => activity.status !== 'REJECTED') ?? null;

  return <EnhancedActivityForm
    userId={userId}
    scoringRules={settings.scoringRules}
    maintenanceMode={settings.maintenanceMode}
    maintenanceMessage={settings.maintenanceMessage}
    recentActivities={recentActivities.map((activity) => ({ ...activity, occurredAt: activity.occurredAt.toISOString() }))}
    lastActivity={last ? { category: last.category, distance: last.distance, pace: last.pace } : null}
  />;
}
