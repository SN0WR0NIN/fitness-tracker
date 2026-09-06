import { redirect } from 'next/navigation';
import AdminPasswordResets from '@/components/AdminPasswordResets';
import Navbar from '@/components/Navbar';
import { requireAdmin } from '@/lib/adminGuard';
import { getPasswordResetRequests } from '@/lib/password-reset';

export const dynamic = 'force-dynamic';

export default async function AdminPasswordResetsPage() {
  const guard = await requireAdmin();
  if (guard.status === 401) redirect('/auth/login');
  if (guard.error) redirect('/dashboard');

  const requests = await getPasswordResetRequests();
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <AdminPasswordResets initialRequests={requests.map((request) => ({
        ...request,
        requestedAt: request.requestedAt.toISOString(),
        lastRequestedAt: request.lastRequestedAt.toISOString(),
        issuedAt: request.issuedAt?.toISOString() ?? null,
        expiresAt: request.expiresAt?.toISOString() ?? null,
        completedAt: request.completedAt?.toISOString() ?? null,
        cancelledAt: request.cancelledAt?.toISOString() ?? null,
      }))} />
    </div>
  );
}
