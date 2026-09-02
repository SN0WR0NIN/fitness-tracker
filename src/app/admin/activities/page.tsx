'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { CheckCircle, XCircle, ShieldCheck, ExternalLink, Pencil } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { formatDistance, formatPace } from '@/lib/format';

const ACTIVITY_CATEGORIES = [
  { value: 'RUN', label: 'Run' },
  { value: 'CYCLE', label: 'Cycle' },
  { value: 'SWIM', label: 'Swim' },
  { value: 'WALK_OR_HIKE', label: 'Walk/Hike' },
  { value: 'TROOP_GAMES', label: 'Troop Games' },
];

interface PendingActivity {
  id: string;
  category: string;
  distance: number;
  pace?: number;
  points: number;
  completedWithFriend: boolean;
  companion?: string;
  companionUserId?: string | null;
  proofUrl?: string;
  stravaActivityId?: string;
  status: string;
  occurredAt: string;
  user: { id: string; name: string; email: string };
  column: { id: string; name: string };
}

interface SelectableUser {
  id: string;
  name: string;
}

export default function AdminActivitiesPage() {
  const router = useRouter();
  const { status } = useSession();
  const [activities, setActivities] = useState<PendingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    category: '',
    distance: '',
    pace: '',
    companionSelect: '', // '' = none, '__manual__' = unregistered friend, otherwise a user id
    companionName: '',
  });
  const [users, setUsers] = useState<SelectableUser[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    if (status === 'authenticated') {
      fetchActivities(filter);
      fetch('/api/admin/users')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setUsers(data.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))))
        .catch(() => setUsers([]));
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

  const startEdit = (activity: PendingActivity) => {
    setEditingId(activity.id);
    setEditForm({
      category: activity.category,
      distance: activity.distance?.toString() ?? '',
      pace: activity.pace?.toString() ?? '',
      companionSelect: activity.companionUserId ?? (activity.completedWithFriend ? '__manual__' : ''),
      companionName: activity.companionUserId ? '' : activity.companion ?? '',
    });
  };

  const saveEdit = async (id: string, ownerId: string) => {
    setActioningId(id);
    try {
      const body: Record<string, unknown> = {
        category: editForm.category,
        distance: editForm.distance ? parseFloat(editForm.distance) : undefined,
        pace: editForm.pace ? parseFloat(editForm.pace) : undefined,
      };
      if (editForm.companionSelect === '__manual__') {
        body.companionName = editForm.companionName.trim() || null;
      } else {
        body.companionUserId = editForm.companionSelect || null;
      }
      const response = await fetch(`/api/admin/activities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const updated = await response.json();
        setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
        setEditingId(null);
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
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{activity.user.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {activity.column.name} &middot;{' '}
                      {new Date(activity.occurredAt).toLocaleString()}
                    </p>

                    {editingId === activity.id ? (
                      <div className="mt-3 flex flex-wrap gap-2 items-center">
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
                        >
                          {ACTIVITY_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.distance}
                          onChange={(e) => setEditForm({ ...editForm, distance: e.target.value })}
                          placeholder="Distance"
                          className="w-28 px-3 py-1.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.pace}
                          onChange={(e) => setEditForm({ ...editForm, pace: e.target.value })}
                          placeholder="Pace (min/km)"
                          className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
                        />
                        <select
                          value={editForm.companionSelect}
                          onChange={(e) => setEditForm({ ...editForm, companionSelect: e.target.value })}
                          className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
                        >
                          <option value="">No companion</option>
                          <option value="__manual__">Friend not registered yet…</option>
                          {users
                            .filter((u) => u.id !== activity.user.id)
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                With {u.name}
                              </option>
                            ))}
                        </select>
                        {editForm.companionSelect === '__manual__' && (
                          <input
                            type="text"
                            value={editForm.companionName}
                            onChange={(e) => setEditForm({ ...editForm, companionName: e.target.value })}
                            placeholder="Friend's name"
                            className="w-40 px-3 py-1.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
                          />
                        )}
                        <button
                          onClick={() => saveEdit(activity.id, activity.user.id)}
                          disabled={actioningId === activity.id}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 font-medium capitalize text-gray-900 dark:text-gray-100">
                        {activity.category.replace(/_/g, ' ')}
                        {activity.distance
                          ? ` — ${formatDistance(activity.distance)}${activity.category === 'SWIM' ? 'm' : 'km'}`
                          : ''}
                        {activity.pace ? ` @ ${formatPace(activity.pace)} min/km` : ''}
                      </p>
                    )}

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
                      {editingId !== activity.id && (
                        <button
                          onClick={() => startEdit(activity)}
                          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{activity.points.toFixed(1)} pts</p>
                    <div className="flex gap-2 mt-3">
                      {activity.status !== 'APPROVED' && (
                        <button
                          onClick={() => handleApprove(activity.id)}
                          disabled={actioningId === activity.id}
                          className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                      )}
                      {activity.status !== 'REJECTED' && (
                        <button
                          onClick={() => handleReject(activity.id)}
                          disabled={actioningId === activity.id}
                          className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      )}
                    </div>
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
