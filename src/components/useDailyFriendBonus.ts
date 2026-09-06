'use client';
import { useEffect, useState } from 'react';
import type { ActivityCategory } from '@/lib/scoring';

type Availability = { available: boolean; used: boolean; pending: boolean; eligibleSport: boolean };
/** Availability is an estimate; only the server transaction awards points. */
export function useDailyFriendBonus(userId: string, activityDate: string, category: ActivityCategory) {
  const key = `${userId}|${activityDate}|${category}`;
  const [result, setResult] = useState<{ key: string; value?: Availability } | null>(null);
  useEffect(() => {
    if (!userId || !activityDate) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ userId, activityDate, category });
      void fetch(`/api/activities/friend-bonus?${query}`, { cache: 'no-store', signal: abort.signal })
        .then(async response => {
          if (!response.ok) throw new Error('Unavailable');
          const value = await response.json() as Availability;
          if (!abort.signal.aborted) setResult({ key, value });
        }).catch(() => { if (!abort.signal.aborted) setResult({ key }); });
    }, 150);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [userId, activityDate, category, key]);
  const value = result?.key === key ? result.value : undefined;
  const message = !value ? 'Bonus estimate excludes the friend bonus until daily eligibility is checked. Final points are confirmed on approval.'
    : !value.eligibleSport ? 'Troop Games uses its fixed session points and has no friend bonus.'
    : value.used ? 'Friend bonus already earned for this sport on this Singapore date. This activity still earns its normal activity points.'
    : value.pending ? 'Another submission is awaiting this sport’s daily bonus. Only one approved activity can receive it.'
    : 'One friend bonus is available for this sport and Singapore date, subject to approval.';
  return { available: value?.available === true, message };
}
