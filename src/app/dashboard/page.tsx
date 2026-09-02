'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Activity, TrendingUp, Users, ExternalLink } from 'lucide-react';
import Navbar from '@/components/Navbar';
import StravaIcon from '@/components/StravaIcon';
import { formatDistance, formatPace } from '@/lib/format';

interface Activity {
  id: string;
  category: string;
  distance: number;
  pace?: number;
  points: number;
  completedWithFriend: boolean;
  companion?: string | null;
  companionUserId?: string | null;
  status: string;
  occurredAt: string;
  stravaActivityId?: string;
  user: {
    name: string;
  };
}

interface SelectableUser {
  id: string;
  name: string;
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
  const [users, setUsers] = useState<SelectableUser[]>([]);
  const [editingCompanionId, setEditingCompanionId] = useState<string | null>(null);
  const [companionSelect, setCompanionSelect] = useState('');
  const [savingCompanion, setSavingCompanion] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    if (status === 'authenticated' && session.user.id) {
      fetchActivities(session.user.id);
      fetchCurrentUser();
      fetch('/api/users')
        .then((res) => (res.ok ? res.json() : []))
        .then(setUsers)
        .catch(() => setUsers([]));
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

  const startEditCompanion = (activity: Activity) => {
    setEditingCompanionId(activity.id);
    setCompanionSelect(activity.companionUserId ?? '');
  };

  const saveCompanion = async (id: string) => {
    setSavingCompanion(true);
    try {
      const response = await fetch(`/api/activities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionUserId: companionSelect || null }),
      });
      if (response.ok) {
        const updated = await response.json();
        setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
        setEditingCompanionId(null);
      }
    } finally {
      setSavingCompanion(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <Link
            href="/activities/new"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Log Activity
          </Link>
        </div>

        {/* Strava Connection */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <StravaIcon className="w-8 h-8 text-orange-500" />
            <div>
              <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">Strava</h2>
              {syncMessage && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{syncMessage}</p>}
            </div>
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
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Points</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalPoints.toFixed(1)}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-blue-100 dark:text-blue-900" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Activities Logged</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{totalActivities}</p>
              </div>
              <Activity className="w-12 h-12 text-green-100 dark:text-green-900" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Average Points</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {totalActivities > 0 ? (totalPoints / totalActivities).toFixed(1) : '0'}
                </p>
              </div>
              <Users className="w-12 h-12 text-purple-100 dark:text-purple-900" />
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Recent Activities</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          ) : activities.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <p>No activities logged yet.</p>
              <Link href="/activities/new" className="text-blue-600 dark:text-blue-400 hover:text-blue-700">
                Log your first activity →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="text-left px-6 py-3 font-semibold text-gray-700 dark:text-gray-300">
                      Date
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-700 dark:text-gray-300">
                      Activity
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-700 dark:text-gray-300">
                      Distance
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-700 dark:text-gray-300">
                      Points
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-700 dark:text-gray-300">
                      With Friend
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-700 dark:text-gray-300">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-700 dark:text-gray-300">
                      
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr
                      key={activity.id}
                      className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {new Date(activity.occurredAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 font-medium capitalize text-gray-900 dark:text-gray-100">
                        {activity.category.replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {activity.distance !== undefined && activity.distance !== null
                          ? `${formatDistance(activity.distance)}${activity.category === 'SWIM' ? 'm' : 'km'}`
                          : ''}
                        {activity.pace ? ` @ ${formatPace(activity.pace)}/km` : ''}
                      </td>
                      <td className="px-6 py-3 font-semibold text-blue-600 dark:text-blue-400">
                        {activity.points.toFixed(1)}
                      </td>
                      <td className="px-6 py-3 text-gray-700 dark:text-gray-300">
                        {editingCompanionId === activity.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={companionSelect}
                              onChange={(e) => setCompanionSelect(e.target.value)}
                              className="px-2 py-1 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded text-xs"
                            >
                              <option value="">No friend</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => saveCompanion(activity.id)}
                              disabled={savingCompanion}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingCompanionId(null)}
                              className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>{activity.completedWithFriend ? `✓ ${activity.companion ?? ''}` : ''}</span>
                            {activity.status === 'PENDING' && activity.stravaActivityId && (
                              <button
                                onClick={() => startEditCompanion(activity)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            activity.status === 'APPROVED'
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : activity.status === 'REJECTED'
                              ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                              : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                          }`}
                        >
                          {activity.status}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {activity.stravaActivityId && (
                          <a
                            href={`https://www.strava.com/activities/${activity.stravaActivityId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> View on Strava
                          </a>
                        )}
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
