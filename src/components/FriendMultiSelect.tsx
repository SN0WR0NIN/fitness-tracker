'use client';

import { useId, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { MAX_ACTIVITY_FRIENDS } from '@/lib/friend-selection';

type Friend = { id: string; name: string; columnName?: string };
export default function FriendMultiSelect({ users, value, onChange, disabled = false, excludeUserId, loading = false }: {
  users: Friend[]; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean; excludeUserId?: string; loading?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const available = useMemo(() => users.filter((user) => user.id !== excludeUserId), [users, excludeUserId]);
  const selected = new Set(value);
  const filtered = available.filter((user) => `${user.name} ${user.columnName ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  function toggle(userId: string) {
    if (disabled || loading) return;
    onChange(selected.has(userId) ? value.filter((entry) => entry !== userId) : [...value, userId].slice(0, MAX_ACTIVITY_FRIENDS));
  }
  return <fieldset disabled={disabled || loading} className="min-w-0 space-y-3 rounded-xl border border-sky-300/20 bg-slate-950/40 p-4">
    <legend className="px-1 text-sm font-bold text-slate-200">Friends</legend>
    <p id={`${id}-help`} className="text-xs leading-5 text-slate-400">Select everyone who joined this activity. The friend bonus is awarded once per activity, not per person.</p>
    <div aria-live="polite" className="text-sm font-bold text-sky-200">{value.length ? `${value.length} ${value.length === 1 ? 'friend' : 'friends'} selected` : 'No friends selected'}</div>
    {value.length ? <div className="flex flex-wrap gap-2">{value.map((userId) => {
      const name = available.find((user) => user.id === userId)?.name ?? 'Unavailable participant';
      return <button key={userId} type="button" aria-label={`Remove ${name}`} onClick={() => onChange(value.filter((entry) => entry !== userId))} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-sky-300/30 bg-sky-300/10 px-3 py-2 text-left text-sm text-sky-100 disabled:opacity-50"><span className="break-words">{name}</span><X aria-hidden="true" className="h-4 w-4 shrink-0" /></button>;
    })}<button type="button" onClick={() => onChange([])} className="min-h-11 px-2 text-xs font-bold text-slate-300 underline disabled:opacity-50">Clear friends</button></div> : null}
    <label htmlFor={`${id}-search`} className="block text-xs font-semibold text-slate-300">Search friends</label>
    <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><input id={`${id}-search`} type="search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} aria-describedby={`${id}-help`} placeholder="Search participant name" className="min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-slate-900 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-sky-300 disabled:opacity-50" /></div>
    {loading ? <p role="status" className="text-sm text-slate-400">Loading participants…</p> : <div className="max-h-56 overflow-y-auto overscroll-contain rounded-lg border border-white/10">{filtered.length ? filtered.map((user) => <label key={user.id} className={`flex min-h-12 cursor-pointer items-center gap-3 border-b border-white/5 px-3 py-3 last:border-0 ${selected.has(user.id) ? 'bg-sky-300/10' : 'hover:bg-white/5'}`}><input type="checkbox" aria-label={user.name} checked={selected.has(user.id)} onChange={() => toggle(user.id)} disabled={disabled || (!selected.has(user.id) && value.length >= MAX_ACTIVITY_FRIENDS)} className="h-5 w-5 shrink-0 accent-sky-400" /><span className="min-w-0 break-words text-sm text-slate-200">{user.name}{user.columnName ? <span className="mt-0.5 block text-xs text-slate-400">{user.columnName}</span> : null}</span></label>) : <p className="p-3 text-sm text-slate-400">{query ? 'No friends match your search.' : 'No other registered participants are available.'}</p>}</div>}
  </fieldset>;
}
