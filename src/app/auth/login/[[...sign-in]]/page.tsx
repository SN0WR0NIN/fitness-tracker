import { SignIn } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { Activity } from 'lucide-react';
import { redirect } from 'next/navigation';
import { clerkPublishableKey } from '@/lib/clerk';

// Clerk uses nested routes for verification and account recovery.
export default async function LoginPage() {
  if (clerkPublishableKey) {
    const { userId } = await auth();
    if (userId) redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-xl text-gray-900 dark:text-gray-100">KG Stay Active Challenge</span>
          </Link>
        </div>
        <div className="flex justify-center">
          {clerkPublishableKey ? <SignIn path="/auth/login" routing="path" forceRedirectUrl="/dashboard" /> : <div className="rounded-lg bg-white p-8 text-red-700 shadow-md dark:bg-gray-900 dark:text-red-300">Clerk environment variables are not configured.</div>}
        </div>
      </div>
    </div>
  );
}
