import PasswordResetForm from '@/components/PasswordResetForm';
import { validatePasswordResetToken } from '@/lib/password-reset';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = (params.token || '').slice(0, 100);
  const valid = await validatePasswordResetToken(token);
  return <PasswordResetForm token={token} initiallyValid={valid} />;
}
