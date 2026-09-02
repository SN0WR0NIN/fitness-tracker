'use client';

import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import Navbar from '@/components/Navbar';

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-6 flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Leaderboards
          </h1>

          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-6 bg-white dark:bg-gray-900 p-6 rounded-lg shadow">
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
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Individual</span>
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
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Team</span>
              </label>
            </div>

            {/* Week Filter */}
            <select
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
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
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          ) : leaderboardType === 'individual' && individualLeaders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Rank
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Column
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Total
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Run
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Cycle
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Swim
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Hike
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {individualLeaders.map((leader, index) => (
                    <tr
                      key={leader.userId}
                      className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      <td className="px-6 py-4 font-bold text-lg text-gray-900 dark:text-gray-100">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                        {leader.userName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {leader.columnName}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-blue-600 dark:text-blue-400">
                        {leader.totalPoints.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                        {leader.runPoints.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                        {leader.cyclePoints.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                        {leader.swimPoints.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
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
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Rank
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Column
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Members
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Total Points
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Avg Points
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {teamLeaders.map((leader, index) => (
                    <tr
                      key={leader.columnId}
                      className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      <td className="px-6 py-4 font-bold text-lg text-gray-900 dark:text-gray-100">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                        {leader.columnName}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                        {leader.memberCount}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-blue-600 dark:text-blue-400">
                        {leader.totalPoints.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                        {leader.averagePoints.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              No data available for this view.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
