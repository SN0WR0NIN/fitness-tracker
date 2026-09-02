'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { formatDistance, formatPace } from '@/lib/format';

interface UserActivity {
  id: string;
  category: string;
  distance: number;
  pace?: number;
  points: number;
  completedWithFriend: boolean;
  companion?: string;
  proofUrl?: string;
  stravaActivityId?: string;
  occurredAt: string;
}

interface UserActivitiesModalProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

export default function UserActivitiesModal({ userId, userName, onClose }: UserActivitiesModalProps) {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/activities?userId=${userId}&status=APPROVED`)
      .then((res) => res.json())
      .then((data) => setActivities(Array.isArray(data) ? data : []))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {userName}&apos;s Approved Activities
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-gray-500 dark:text-gray-400">Loading...</p>
          ) : activities.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400">No approved activities yet.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex justify-between items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div>
                    <p className="font-medium capitalize text-gray-900 dark:text-gray-100">
                      {activity.category.replace(/_/g, ' ')}
                      {activity.distance
                        ? ` — ${formatDistance(activity.distance)}${activity.category === 'SWIM' ? 'm' : 'km'}`
                        : ''}
                      {activity.pace ? ` @ ${formatPace(activity.pace)}/km` : ''}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(activity.occurredAt).toLocaleDateString()}
                      {activity.completedWithFriend ? ` · with ${activity.companion || 'a friend'}` : ''}
                    </p>
                    <div className="flex gap-3 mt-1">
                      {activity.stravaActivityId && (
                        <a
                          href={`https://www.strava.com/activities/${activity.stravaActivityId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> View on Strava
                        </a>
                      )}
                      {activity.proofUrl && (
                        <a
                          href={activity.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View proof
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="font-bold text-blue-600 dark:text-blue-400 shrink-0">
                    {activity.points.toFixed(1)} pts
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
