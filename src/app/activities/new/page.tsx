import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import NewActivityForm from '@/components/NewActivityForm';
import { authOptions } from '@/lib/auth';
import { getChallengeSettings } from '@/lib/admin-control';

export const dynamic = 'force-dynamic';

export default async function NewActivityPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) redirect('/auth/login');

  const settings = await getChallengeSettings();

  return <NewActivityForm userId={userId} scoringRules={settings.scoringRules} maintenanceMode={settings.maintenanceMode} maintenanceMessage={settings.maintenanceMessage} />;
}
