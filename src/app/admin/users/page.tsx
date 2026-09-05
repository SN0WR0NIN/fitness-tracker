'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ShieldCheck, Users as UsersIcon, Trash2 } from 'lucide-react';
import Navbar from '@/components/Navbar';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: 'MEMBER' | 'ADMIN';
  column: { id: string; name: string } | null;
  stravaAthleteId?: string | null;
  createdAt: string;
}

interface Column {
  id: string;
  name: string;
}

export default function ManageUsersPage() {
  const router = useRouter();
  const { status } = useSession();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    if (status === 'authenticated') {
      fetch('/api/admin/users').then(async (response) => {
        if (response.status === 403) { setForbidden(true); return; }
        if (!response.ok) throw new Error('Failed to fetch users');
        setUsers(await response.json());
      }).catch(() => setErrorMessage('Failed to fetch users')).finally(() => setLoading(false));
      fetch('/api/columns')
        .then((res) => res.json())
        .then((data) => setColumns(data))
        .catch(() => setColumns([]));
    }
  }, [status, router]);

  const updateUser = async (id: string, changes: Partial<Pick<ManagedUser, 'role'>> & { columnId?: string | null }) => {
    setSavingId(id);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const data = await response.json();
      if (response.ok) {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
      } else {
        setErrorMessage(typeof data.error === 'string' ? data.error : 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setErrorMessage('Failed to update user');
    } finally {
      setSavingId(null);
    }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Delete ${name}? This also permanently deletes all of their logged activities. This cannot be undone.`)) {
      return;
    }
    setSavingId(id);
    setErrorMessage('');
    try {
      const response = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (response.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
      } else {
        setErrorMessage(typeof data.error === 'string' ? data.error : 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setErrorMessage('Failed to delete user');
    } finally {
      setSavingId(null);
    }
  };

  if (forbidden) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <ShieldCheck className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Admins only</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">You don&apos;t have permission to manage users.</p>
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
          <UsersIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          Manage Users
        </h1>
        <Link href="/admin/import" className="mb-6 inline-block rounded-lg bg-orange-500 px-4 py-3 font-bold text-white">Import historical activities / link participants</Link>
        <Link href="/admin/accounts" className="mb-6 ml-3 inline-block rounded-lg border border-orange-500 px-4 py-3 font-bold text-orange-500">Create logins / confirm emails</Link>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Column
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {user.name}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {user.email.endsWith('@participants.invalid') ? 'No confirmed email' : user.email}
                      </td>
                      <td className="px-6 py-3">
                        <select
                          value={user.column?.id ?? ''}
                          disabled={savingId === user.id}
                          onChange={(e) => updateUser(user.id, { columnId: e.target.value || null })}
                          className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm disabled:opacity-50"
                        >
                          <option value="">No column</option>
                          {columns.map((column) => (
                            <option key={column.id} value={column.id}>
                              {column.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-3">
                        <select
                          value={user.role}
                          disabled={savingId === user.id}
                          onChange={(e) => updateUser(user.id, { role: e.target.value as 'MEMBER' | 'ADMIN' })}
                          className={`px-3 py-1.5 border rounded-lg text-sm font-medium disabled:opacity-50 ${
                            user.role === 'ADMIN'
                              ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              : 'border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
                          }`}
                        >
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => deleteUser(user.id, user.name)}
                          disabled={savingId === user.id}
                          aria-label={`Delete ${user.name}`}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
