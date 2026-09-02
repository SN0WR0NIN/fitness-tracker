'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { Activity, TrendingUp, Users, ShieldCheck } from 'lucide-react';

interface Activity {
  id: string;
  category: string;
  distance: number;
  pace?: number;
  points: number;
  completedWithFriend: boolean;
  status: string;
  createdAt: string;
  user: {
    name: string;
  };
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  column: { id: string; name: string } | null;
  stravaConnected: boolean;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    if (status === 'authenticated' && session.user.id) {
      fetchActivities(session.user.id);
      fetchCurrentUser();
    }
  }, [status, session, router]);

  useEffect(() => {
    if (searchParams.get('stravaConnected') === 'true') {
      setSyncMessage('Strava connected! Click "Sync Activities" to import your workouts.');
    } else if (searchParams.get('stravaError')) {
      setSyncMessage(`Strava connection failed: ${searchParams.get('stravaError')}`);
    }
  }, [searchParams]);

  const fetchActivities = async (userId: string) => {
    try {
      const response = await fetch(`/api/activities?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/user/me');
      if (response.ok) {
        setCurrentUser(await response.json());
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const response = await fetch('/api/strava/sync', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setSyncMessage(`Imported ${data.imported} new activities (${data.skipped} already synced).`);
        if (session?.user.id) fetchActivities(session.user.id);
      } else {
        setSyncMessage(data.error || 'Failed to sync Strava activities');
      }
    } catch (error) {
      console.error('Error syncing Strava:', error);
      setSyncMessage('Failed to sync Strava activities');
    } finally {
      setSyncing(false);
    }
  };

  const approvedActivities = activities.filter((activity) => activity.status === 'APPROVED');
  const totalPoints = approvedActivities.reduce((sum, activity) => sum + activity.points, 0);
  const totalActivities = approvedActivities.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600" />
            <span className="font-bold text-lg">Fitness Tracker</span>
          </Link>
          <div className="flex gap-4 items-center">
            <Link href="/" className="text-gray-600 hover:text-gray-900">
              Home
            </Link>
            <Link href="/leaderboard" className="text-gray-600 hover:text-gray-900">
              Leaderboard
            </Link>
            {currentUser?.role === 'ADMIN' && (
              <Link href="/admin/activities" className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
                <ShieldCheck className="w-4 h-4" /> Review
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-gray-600 hover:text-gray-900"
            >
              Log Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Link
            href="/activities/new"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Log Activity
          </Link>
        </div>

        {/* Strava Connection */}
        <div className="bg-white rounded-lg shadow p-6 mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-bold text-lg">Strava</h2>
            {syncMessage && <p className="text-sm text-gray-600 mt-1">{syncMessage}</p>}
          </div>
          {currentUser?.stravaConnected ? (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync Activities'}
            </button>
          ) : (
            // Plain <a>, not next/link: this route redirects off-site to Strava,
            // and Next's client-side router mishandles external redirects from a Link.
            <a
              href="/api/auth/strava"
              className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              Connect Strava
            </a>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Points</p>
                <p className="text-3xl font-bold text-blue-600">{totalPoints.toFixed(1)}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-blue-100" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Activities Logged</p>
                <p className="text-3xl font-bold text-green-600">{totalActivities}</p>
              </div>
              <Activity className="w-12 h-12 text-green-100" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Average Points</p>
                <p className="text-3xl font-bold text-purple-600">
                  {totalActivities > 0 ? (totalPoints / totalActivities).toFixed(1) : '0'}
                </p>
              </div>
              <Users className="w-12 h-12 text-purple-100" />
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold">Recent Activities</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : activities.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p>No activities logged yet.</p>
              <Link href="/activities/new" className="text-blue-600 hover:text-blue-700">
                Log your first activity →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-6 py-3 font-semibold text-gray-700">
                      Date
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-700">
                      Activity
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-700">
                      Distance
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-700">
                      Points
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-700">
                      With Friend
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-700">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr
                      key={activity.id}
                      className="border-b border-gray-200 hover:bg-gray-50 transition"
                    >
                      <td className="px-6 py-3 text-sm">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 font-medium capitalize">
                        {activity.category.replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        {activity.distance}{' '}
                        {activity.category === 'SWIM' ? 'm' : 'km'}
                      </td>
                      <td className="px-6 py-3 font-semibold text-blue-600">
                        {activity.points.toFixed(1)}
                      </td>
                      <td className="px-6 py-3">
                        {activity.completedWithFriend ? '✓' : ''}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            activity.status === 'APPROVED'
                              ? 'bg-green-100 text-green-700'
                              : activity.status === 'REJECTED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {activity.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <DashboardContent />
    </Suspense>
  );
}
