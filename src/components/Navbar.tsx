'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useState, useSyncExternalStore } from 'react';
import { BookOpen, Home, Menu, Moon, Settings, ShieldCheck, Sun, Trophy, Users, X } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import AppStatusBanner from '@/components/AppStatusBanner';
import SiteBrandName from '@/components/SiteBrandName';

const emptySubscribe = () => () => {};

export default function Navbar() {
  const { data: session, status } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = session?.user?.role === 'ADMIN';
  const closeMenu = () => setMenuOpen(false);
  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  return (
    <>
      <nav className="relative z-50 border-b border-gray-200 bg-white transition-colors dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" onClick={closeMenu} className="flex min-w-0 items-center gap-2">
            <Image src="/2902.jpg" alt="KG Stay Active Challenge" width={32} height={32} className="h-8 w-8 shrink-0 rounded object-cover" />
            <span className="max-w-[12rem] truncate sm:max-w-none"><SiteBrandName /></span>
          </Link>

          <div className="hidden items-center gap-4 text-sm md:flex">
            <DesktopLinks authenticated={status === 'authenticated'} isAdmin={isAdmin} />
            {status === 'authenticated' ? <button onClick={() => signOut({ callbackUrl: '/' })} className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Log Out</button> : null}
            {status === 'authenticated' && session?.user?.id ? <NotificationBell userId={session.user.id} /> : null}
            <ThemeButton mounted={mounted} resolvedTheme={resolvedTheme} onClick={toggleTheme} />
          </div>

          <div className="flex items-center gap-1 md:hidden">
            {status === 'authenticated' && session?.user?.id ? <NotificationBell userId={session.user.id} /> : null}
            <ThemeButton mounted={mounted} resolvedTheme={resolvedTheme} onClick={toggleTheme} />
            <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation menu" aria-expanded={menuOpen} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>

        {menuOpen ? (
          <div className="absolute inset-x-0 top-full border-b border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-800 dark:bg-gray-900 md:hidden">
            <div className="mx-auto grid max-w-7xl gap-1 text-sm font-semibold">
              <MobileLink href="/" icon={<Home />} onClick={closeMenu}>Home</MobileLink>
              {status === 'authenticated' ? <MobileLink href="/dashboard" icon={<Home />} onClick={closeMenu}>Dashboard</MobileLink> : null}
              <MobileLink href="/leaderboard" icon={<Trophy />} onClick={closeMenu}>Leaderboard</MobileLink>
              <MobileLink href="/rules" icon={<BookOpen />} onClick={closeMenu}>Rules</MobileLink>
              {isAdmin ? <><MobileLink href="/admin" icon={<Settings />} onClick={closeMenu}>Control centre</MobileLink><MobileLink href="/admin/activities" icon={<ShieldCheck />} onClick={closeMenu}>Activity review</MobileLink><MobileLink href="/admin/users" icon={<Users />} onClick={closeMenu}>Manage users</MobileLink></> : null}
              {status === 'authenticated' ? <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="mt-2 rounded-xl border border-gray-200 px-4 py-3 text-left text-rose-600 dark:border-gray-800 dark:text-rose-300">Log Out</button> : <MobileLink href="/auth/login" icon={<Users />} onClick={closeMenu}>Login</MobileLink>}
            </div>
          </div>
        ) : null}
      </nav>
      <AppStatusBanner />
      <AnnouncementBanner />
    </>
  );
}

function DesktopLinks({ authenticated, isAdmin }: { authenticated: boolean; isAdmin: boolean }) {
  const linkClass = 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white';
  return <>{authenticated ? <Link href="/dashboard" className={linkClass}>Dashboard</Link> : null}<Link href="/leaderboard" className={linkClass}>Leaderboard</Link><Link href="/rules" className={linkClass}>Rules</Link>{isAdmin ? <><Link href="/admin" className={`flex items-center gap-1 ${linkClass}`}><Settings className="h-4 w-4" />Control</Link><Link href="/admin/activities" className={`flex items-center gap-1 ${linkClass}`}><ShieldCheck className="h-4 w-4" />Review</Link><Link href="/admin/users" className={`flex items-center gap-1 ${linkClass}`}><Users className="h-4 w-4" />Users</Link></> : null}{!authenticated ? <Link href="/auth/login" className={linkClass}>Login</Link> : null}</>;
}

function MobileLink({ href, icon, onClick, children }: { href: string; icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return <Link href={href} onClick={onClick} className="flex items-center gap-3 rounded-xl px-4 py-3 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"><span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>{children}</Link>;
}

function ThemeButton({ mounted, resolvedTheme, onClick }: { mounted: boolean; resolvedTheme: string | undefined; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label="Toggle dark mode" className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">{mounted && resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>;
}
