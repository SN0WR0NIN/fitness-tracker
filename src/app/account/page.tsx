import { UserProfile } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import AccountFeatureLinks from '@/components/AccountFeatureLinks';
import { getAppSession } from '@/lib/auth';

export default async function AccountPage() {
  const session = await getAppSession();
  if (!session?.user?.id) redirect('/auth/login');
  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white"><div className="mx-auto max-w-4xl space-y-6"><AccountFeatureLinks/><UserProfile path="/account" routing="path" /></div></main>;
}
