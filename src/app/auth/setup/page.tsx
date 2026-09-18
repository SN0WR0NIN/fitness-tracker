import { redirect } from 'next/navigation';

export default function SetupPage() {
  redirect('/auth/login');
}
