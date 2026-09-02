'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Activity, TrendingUp, Users } from 'lucide-react';

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Fitness Tracker</h1>
          </div>
          <div className="flex gap-4 items-center">
            <Link
              href="/dashboard"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Dashboard
            </Link>
            {status === 'authenticated' ? (
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Log Out
              </button>
            ) : (
              <Link
                href="/auth/login"
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Track Your Fitness Journey
          </h2>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Log your runs, cycles, swims, and hikes. Compete with your team on leaderboards and earn points for every activity.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/activities/new"
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Log Activity
            </Link>
            <Link
              href="/leaderboard"
              className="px-8 py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition font-medium"
            >
              View Leaderboard
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white rounded-lg p-8 shadow-md">
            <Activity className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Easy Logging</h3>
            <p className="text-gray-600">
              Quickly log your activities with distance, pace, and proof screenshots.
            </p>
          </div>
          <div className="bg-white rounded-lg p-8 shadow-md">
            <TrendingUp className="w-12 h-12 text-green-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Smart Scoring</h3>
            <p className="text-gray-600">
              Earn points based on activity type, distance, and pace. Bonus points for group activities.
            </p>
          </div>
          <div className="bg-white rounded-lg p-8 shadow-md">
            <Users className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">Team Competition</h3>
            <p className="text-gray-600">
              Compete individually and as a team. Track weekly and all-time leaderboards.
            </p>
          </div>
        </div>

        {/* Strava Integration */}
        <div className="mt-20 bg-white rounded-lg p-12 shadow-lg">
          <h3 className="text-2xl font-bold mb-4">Strava Integration</h3>
          <p className="text-gray-600 mb-6">
            Connect your Strava account to automatically import your activities.
          </p>
          {/* Plain <a>, not next/link: this route redirects off-site to Strava */}
          <a
            href="/api/auth/strava"
            className="inline-block px-8 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium"
          >
            Connect Strava
          </a>
        </div>
      </div>
    </div>
  );
}
