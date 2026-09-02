'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Trophy } from 'lucide-react';

interface IndividualLeader {
  userId: string;
  userName: string;
  columnName: string;
  totalPoints: number;
  runPoints: number;
  cyclePoints: number;
  swimPoints: number;
  hikePoints: number;
  troopGamePoints: number;
}

interface TeamLeader {
  columnId: string;
  columnName: string;
  memberCount: number;
  totalPoints: number;
  averagePoints: number;
}

export default function LeaderboardPage() {
  const [leaderboardType, setLeaderboardType] = useState<'individual' | 'team'>(
    'individual'
  );
  const [week, setWeek] = useState<string>('all');
  const [individualLeaders, setIndividualLeaders] = useState<IndividualLeader[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [leaderboardType, week]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const weekParam = week === 'all' ? '' : `&weekNumber=${week}`;
      const response = await fetch(
        `/api/leaderboard?type=${leaderboardType}${weekParam}`
      );
      if (response.ok) {
        const data = await response.json();
        if (leaderboardType === 'individual') {
          setIndividualLeaders(data.leaderboard);
        } else {
          setTeamLeaders(data.leaderboard);
        }
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <Activity className="w-8 h-8 text-blue-600" />
            <span className="font-bold text-lg">Fitness Tracker</span>
          </Link>
          <div className="flex gap-4">
            <Link href="/" className="text-gray-600 hover:text-gray-900">
              Home
            </Link>
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Leaderboards
          </h1>

          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-6 bg-white p-6 rounded-lg shadow">
            {/* Type Toggle */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="individual"
                  checked={leaderboardType === 'individual'}
                  onChange={(e) =>
                    setLeaderboardType(e.target.value as 'individual' | 'team')
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Individual</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="team"
                  checked={leaderboardType === 'team'}
                  onChange={(e) =>
                    setLeaderboardType(e.target.value as 'individual' | 'team')
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Team</span>
              </label>
            </div>

            {/* Week Filter */}
            <select
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="1">Week 1</option>
              <option value="2">Week 2</option>
              <option value="3">Week 3</option>
              <option value="4">Week 4</option>
              <option value="5">Week 5</option>
            </select>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading...</div>
          ) : leaderboardType === 'individual' && individualLeaders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Rank
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Column
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                      Total
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                      Run
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                      Cycle
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                      Swim
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                      Hike
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {individualLeaders.map((leader, index) => (
                    <tr
                      key={leader.userId}
                      className="border-b border-gray-200 hover:bg-gray-50 transition"
                    >
                      <td className="px-6 py-4 font-bold text-lg">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {leader.userName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {leader.columnName}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-blue-600">
                        {leader.totalPoints.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {leader.runPoints.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {leader.cyclePoints.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {leader.swimPoints.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {leader.hikePoints.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : leaderboardType === 'team' && teamLeaders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Rank
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Column
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                      Members
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                      Total Points
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                      Avg Points
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {teamLeaders.map((leader, index) => (
                    <tr
                      key={leader.columnId}
                      className="border-b border-gray-200 hover:bg-gray-50 transition"
                    >
                      <td className="px-6 py-4 font-bold text-lg">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {leader.columnName}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {leader.memberCount}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-blue-600">
                        {leader.totalPoints.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {leader.averagePoints.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              No data available for this view.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
