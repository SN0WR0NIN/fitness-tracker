import PasswordResetForm from '@/components/PasswordResetForm';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <PasswordResetForm token={(params.token || '').slice(0, 4096)} />;
}
