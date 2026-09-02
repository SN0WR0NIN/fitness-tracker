'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Activity, ShieldCheck, Moon, Sun, Users } from 'lucide-react';

export default function Navbar() {
  const { data: session, status } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <span className="font-bold text-lg text-gray-900 dark:text-gray-100">Fitness Tracker</span>
        </Link>
        <div className="flex gap-4 items-center text-sm">
          {status === 'authenticated' ? (
            <>
              <Link href="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                Dashboard
              </Link>
              <Link href="/leaderboard" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                Leaderboard
              </Link>
              {isAdmin && (
                <>
                  <Link
                    href="/admin/activities"
                    className="flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  >
                    <ShieldCheck className="w-4 h-4" /> Review
                  </Link>
                  <Link
                    href="/admin/users"
                    className="flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  >
                    <Users className="w-4 h-4" /> Users
                  </Link>
                </>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link href="/leaderboard" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                Leaderboard
              </Link>
              <Link href="/auth/login" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                Login
              </Link>
            </>
          )}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle dark mode"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
          >
            {mounted && resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </nav>
  );
}
