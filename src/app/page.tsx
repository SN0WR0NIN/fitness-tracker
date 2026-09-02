'use client';

import Link from 'next/link';
import { Activity, TrendingUp, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900">
      <Navbar />

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Track Your Fitness Journey
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
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
              className="px-8 py-3 border-2 border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition font-medium"
            >
              View Leaderboard
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-8 shadow-md">
            <Activity className="w-12 h-12 text-blue-600 dark:text-blue-400 mb-4" />
            <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Easy Logging</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Quickly log your activities with distance, pace, and proof screenshots.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-8 shadow-md">
            <TrendingUp className="w-12 h-12 text-green-600 dark:text-green-400 mb-4" />
            <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Smart Scoring</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Earn points based on activity type, distance, and pace. Bonus points for group activities.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-8 shadow-md">
            <Users className="w-12 h-12 text-purple-600 dark:text-purple-400 mb-4" />
            <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Team Competition</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Compete individually and as a team. Track weekly and all-time leaderboards.
            </p>
          </div>
        </div>

        {/* Strava Integration */}
        <div className="mt-20 bg-white dark:bg-gray-900 rounded-lg p-12 shadow-lg">
          <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Strava Integration</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
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
