import PasswordResetForm from '@/components/PasswordResetForm';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ identifier?: string }> }) {
  const params = await searchParams;
  return <PasswordResetForm initialIdentifier={(params.identifier || '').slice(0, 254)} />;
}
