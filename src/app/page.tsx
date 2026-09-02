'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, TrendingUp, Users, Trophy } from 'lucide-react';
import Navbar from '@/components/Navbar';
import UserActivitiesModal from '@/components/UserActivitiesModal';
import StravaIcon from '@/components/StravaIcon';
import { formatDistance } from '@/lib/format';
import { getMapboxStaticMapUrl } from '@/lib/mapbox';

interface IndividualLeader {
  userId: string;
  userName: string;
  columnName: string;
  totalPoints: number;
}

interface TeamLeader {
  columnId: string;
  columnName: string;
  memberCount: number;
  totalPoints: number;
  averagePoints: number;
}

interface RecentActivity {
  id: string;
  category: string;
  distance: number;
  points: number;
  proofUrl?: string;
  stravaActivityId?: string;
  mapPolyline?: string;
  user: { id: string; name: string };
}

const PREVIEW_COUNT = 8;

export default function Home() {
  const [individualLeaders, setIndividualLeaders] = useState<IndividualLeader[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [recentApproved, setRecentApproved] = useState<RecentActivity[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [selectedUser, setSelectedUser] = useState<{ userId: string; userName: string } | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/leaderboard?type=individual').then((res) => res.json()),
      fetch('/api/leaderboard?type=team').then((res) => res.json()),
      fetch('/api/activities?status=APPROVED&limit=8').then((res) => res.json()),
    ])
      .then(([individual, team, approved]) => {
        setIndividualLeaders(individual.leaderboard ?? []);
        setTeamLeaders(team.leaderboard ?? []);
        setRecentApproved(Array.isArray(approved) ? approved : []);
      })
      .catch((error) => console.error('Error fetching leaderboards:', error))
      .finally(() => setLoadingBoards(false));
  }, []);

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

        {/* Leaderboards */}
        <div className="grid lg:grid-cols-2 gap-8 mt-20">
          {/* Individual Leaderboard */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Individual Leaderboard
              </h3>
              <Link href="/leaderboard" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                View all
              </Link>
            </div>
            {loadingBoards ? (
              <p className="p-6 text-center text-gray-500 dark:text-gray-400">Loading...</p>
            ) : individualLeaders.length === 0 ? (
              <p className="p-6 text-center text-gray-500 dark:text-gray-400">No approved activities yet.</p>
            ) : (
              <ul>
                {individualLeaders.slice(0, PREVIEW_COUNT).map((leader, index) => (
                  <li key={leader.userId}>
                    <button
                      onClick={() => setSelectedUser(leader)}
                      className="w-full flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-left"
                    >
                      <span className="flex items-center gap-3">
                        <span className="font-bold text-gray-500 dark:text-gray-400 w-6">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </span>
                        <span>
                          <span className="block font-medium text-gray-900 dark:text-gray-100">
                            {leader.userName}
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {leader.columnName}
                          </span>
                        </span>
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {leader.totalPoints.toFixed(1)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Team Leaderboard */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Users className="w-5 h-5 text-purple-500" />
                Team Leaderboard
              </h3>
              <Link href="/leaderboard" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                View all
              </Link>
            </div>
            {loadingBoards ? (
              <p className="p-6 text-center text-gray-500 dark:text-gray-400">Loading...</p>
            ) : teamLeaders.length === 0 ? (
              <p className="p-6 text-center text-gray-500 dark:text-gray-400">No teams yet.</p>
            ) : (
              <ul>
                {teamLeaders.slice(0, PREVIEW_COUNT).map((team, index) => (
                  <li key={team.columnId} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <button
                      onClick={() => setExpandedTeam(expandedTeam === team.columnId ? null : team.columnId)}
                      className="w-full flex items-center justify-between px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-left"
                    >
                      <span className="flex items-center gap-3">
                        <span className="font-bold text-gray-500 dark:text-gray-400 w-6">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </span>
                        <span>
                          <span className="block font-medium text-gray-900 dark:text-gray-100">
                            {team.columnName}
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {team.memberCount} members · {team.averagePoints.toFixed(1)} avg
                          </span>
                        </span>
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {team.totalPoints.toFixed(1)}
                      </span>
                    </button>
                    {expandedTeam === team.columnId && (
                      <div className="px-6 pb-3 pl-14 space-y-1">
                        {individualLeaders
                          .filter((leader) => leader.columnName === team.columnName)
                          .sort((a, b) => b.totalPoints - a.totalPoints)
                          .map((member) => (
                            <button
                              key={member.userId}
                              onClick={() => setSelectedUser(member)}
                              className="w-full flex items-center justify-between text-sm py-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition text-left"
                            >
                              <span>{member.userName}</span>
                              <span>{member.totalPoints.toFixed(1)}</span>
                            </button>
                          ))}
                        {individualLeaders.filter((leader) => leader.columnName === team.columnName).length === 0 && (
                          <p className="text-sm text-gray-400 dark:text-gray-500">No approved activities yet.</p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recently Approved Activities */}
        <div className="mt-20">
          <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Recently Approved</h3>
          {loadingBoards ? (
            <p className="text-center text-gray-500 dark:text-gray-400">Loading...</p>
          ) : recentApproved.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400">No approved activities yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentApproved.map((activity) => {
                const mapUrl = getMapboxStaticMapUrl(activity.mapPolyline, { width: 400, height: 300 });
                const enlargeTarget = activity.proofUrl || mapUrl;
                return (
                  <button
                    key={activity.id}
                    onClick={() =>
                      enlargeTarget
                        ? setEnlargedPhoto(enlargeTarget)
                        : setSelectedUser({ userId: activity.user.id, userName: activity.user.name })
                    }
                    className="bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden text-left hover:shadow-lg hover:-translate-y-0.5 transition"
                  >
                    <div className="h-40 bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                      {activity.proofUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={activity.proofUrl}
                          alt={`${activity.user.name}'s activity proof`}
                          className="w-full h-full object-cover"
                        />
                      ) : mapUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mapUrl}
                          alt={`${activity.user.name}'s route map`}
                          className="w-full h-full object-cover"
                        />
                      ) : activity.stravaActivityId ? (
                        <StravaIcon className="w-16 h-16 text-orange-500" />
                      ) : (
                        <Activity className="w-16 h-16 text-gray-300 dark:text-gray-700" />
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{activity.user.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                        {activity.category.replace(/_/g, ' ')}
                        {activity.distance
                          ? ` — ${formatDistance(activity.distance)}${activity.category === 'SWIM' ? 'm' : 'km'}`
                          : ''}
                      </p>
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-1">
                        {activity.points.toFixed(1)} pts
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
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
          <StravaIcon className="w-12 h-12 text-orange-500 mb-4" />
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

      {selectedUser && (
        <UserActivitiesModal
          userId={selectedUser.userId}
          userName={selectedUser.userName}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {enlargedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setEnlargedPhoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enlargedPhoto}
            alt="Activity proof enlarged"
            className="max-w-full max-h-full rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
