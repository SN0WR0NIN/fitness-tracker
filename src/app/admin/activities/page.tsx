'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { CheckCircle, XCircle, ShieldCheck, ExternalLink } from 'lucide-react';
import Navbar from '@/components/Navbar';

interface PendingActivity {
  id: string;
  category: string;
  distance: number;
  pace?: number;
  points: number;
  completedWithFriend: boolean;
  companion?: string;
  proofUrl?: string;
  stravaActivityId?: string;
  status: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
  column: { id: string; name: string };
}

export default function AdminActivitiesPage() {
  const router = useRouter();
  const { status } = useSession();
  const [activities, setActivities] = useState<PendingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    if (status === 'authenticated') {
      fetchActivities(filter);
    }
  }, [status, filter, router]);

  const fetchActivities = async (statusFilter: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/activities?status=${statusFilter}`);
      if (response.status === 403) {
        setForbidden(true);
        return;
      }
      if (response.ok) {
        setActivities(await response.json());
      }
    } catch (error) {
      console.error('Error fetching activities for review:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActioningId(id);
    try {
      const response = await fetch(`/api/admin/activities/${id}/approve`, { method: 'POST' });
      if (response.ok) {
        setActivities((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Reason for rejection (optional):') ?? undefined;
    setActioningId(id);
    try {
      const response = await fetch(`/api/admin/activities/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (response.ok) {
        setActivities((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setActioningId(null);
    }
  };

  if (forbidden) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <ShieldCheck className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Admins only</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">You don&apos;t have permission to review activities.</p>
          <Link href="/dashboard" className="text-blue-600 dark:text-blue-400 hover:text-blue-700">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          Review Activities
        </h1>

        <div className="flex gap-2 mb-6">
          {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
            Loading...
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
            No {filter.toLowerCase()} activities.
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <div className="flex justify-between items-start flex-wrap gap-4">
                  <div>
                    <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{activity.user.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {activity.column.name} &middot;{' '}
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-2 font-medium capitalize text-gray-900 dark:text-gray-100">
                      {activity.category.replace(/_/g, ' ')}
                      {activity.distance ? ` — ${activity.distance}${activity.category === 'SWIM' ? 'm' : 'km'}` : ''}
                      {activity.pace ? ` @ ${activity.pace} min/km` : ''}
                    </p>
                    {activity.completedWithFriend && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">With: {activity.companion || 'a friend'}</p>
                    )}
                    <div className="flex gap-3 mt-1">
                      {activity.stravaActivityId && (
                        <a
                          href={`https://www.strava.com/activities/${activity.stravaActivityId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View on Strava
                        </a>
                      )}
                      {activity.proofUrl && (
                        <a
                          href={activity.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 underline"
                        >
                          View proof
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{activity.points.toFixed(1)} pts</p>
                    {filter === 'PENDING' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleApprove(activity.id)}
                          disabled={actioningId === activity.id}
                          className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(activity.id)}
                          disabled={actioningId === activity.id}
                          className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
