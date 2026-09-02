'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Upload, X } from 'lucide-react';
import Navbar from '@/components/Navbar';

const ACTIVITY_CATEGORIES = [
  { value: 'RUN', label: 'Run', icon: '🏃' },
  { value: 'CYCLE', label: 'Cycle', icon: '🚴' },
  { value: 'SWIM', label: 'Swim', icon: '🏊' },
  { value: 'WALK_OR_HIKE', label: 'Walk/Hike', icon: '🥾' },
  { value: 'TROOP_GAMES', label: 'Troop Games', icon: '🎯' },
];

export default function NewActivityPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [category, setCategory] = useState('RUN');
  const [formData, setFormData] = useState({
    distance: '',
    pace: '',
    completedWithFriend: false,
    companion: '',
    proofUrl: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body });
      const data = await response.json();

      if (response.ok) {
        setFormData((prev) => ({ ...prev, proofUrl: data.url }));
      } else {
        setUploadError(data.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          distance: formData.distance ? parseFloat(formData.distance) : undefined,
          pace: formData.pace ? parseFloat(formData.pace) : undefined,
          completedWithFriend: formData.completedWithFriend,
          companion: formData.companion,
          proofUrl: formData.proofUrl,
        }),
      });

      if (response.ok) {
        router.push('/dashboard?success=true');
      } else {
        alert('Failed to log activity');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error logging activity');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/dashboard" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 mb-6 inline-flex items-center">
          ← Back
        </Link>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-gray-100">Log New Activity</h1>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                Activity Type
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {ACTIVITY_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`p-4 rounded-lg text-center transition ${
                      category === cat.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-2xl mb-2">{cat.icon}</div>
                    <div className="text-sm font-medium">{cat.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Distance */}
            {category !== 'TROOP_GAMES' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Distance ({category === 'SWIM' ? 'meters' : 'km'})
                </label>
                <input
                  type="number"
                  step="0.1"
                  required={category !== 'TROOP_GAMES'}
                  value={formData.distance}
                  onChange={(e) =>
                    setFormData({ ...formData, distance: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="Enter distance"
                />
              </div>
            )}

            {/* Pace */}
            {category === 'RUN' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pace (min/km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.pace}
                  onChange={(e) => setFormData({ ...formData, pace: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="Enter pace"
                />
              </div>
            )}

            {/* Completed with friend */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="friend"
                checked={formData.completedWithFriend}
                onChange={(e) =>
                  setFormData({ ...formData, completedWithFriend: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-600"
              />
              <label htmlFor="friend" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Completed with a friend?
              </label>
            </div>

            {/* Companion name */}
            {formData.completedWithFriend && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Friend's Name
                </label>
                <input
                  type="text"
                  value={formData.companion}
                  onChange={(e) => setFormData({ ...formData, companion: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="Who did you do this with?"
                />
              </div>
            )}

            {/* Proof Screenshot */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Proof Screenshot
              </label>
              {formData.proofUrl ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formData.proofUrl}
                    alt="Proof preview"
                    className="h-32 rounded-lg border border-gray-300 dark:border-gray-700 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, proofUrl: '' })}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full px-4 py-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition text-gray-500 dark:text-gray-400">
                  <Upload className="w-5 h-5" />
                  <span>{uploading ? 'Uploading...' : 'Click to upload a screenshot'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              )}
              {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading || uploading}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Logging...' : 'Log Activity'}
              </button>
              <Link
                href="/dashboard"
                className="px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
