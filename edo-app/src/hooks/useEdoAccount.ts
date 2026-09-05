'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { EdoAccess, EdoOfficer } from '@/lib/types';

export function useEdoAccount() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<EdoAccess | null>(null);
  const [officer, setOfficer] = useState<EdoOfficer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      if (!sessionData.session) {
        router.replace('/login');
        return;
      }
      setSession(sessionData.session);
      const { data: accessData, error: accessError } = await supabase
        .from('edo_access')
        .select('user_id, officer_id, role, column_code')
        .eq('user_id', sessionData.session.user.id)
        .maybeSingle();
      if (!active) return;
      if (accessError) { setError(accessError.message); setLoading(false); return; }
      if (!accessData) { setError('Your login is valid, but it has not been linked to an EDO officer profile yet.'); setLoading(false); return; }
      setAccess(accessData as EdoAccess);
      if (accessData.officer_id) {
        const { data: officerData, error: officerError } = await supabase.from('edo_officers').select('*').eq('id', accessData.officer_id).maybeSingle();
        if (!active) return;
        if (officerError) setError(officerError.message);
        else setOfficer((officerData as EdoOfficer | null) ?? null);
      }
      setLoading(false);
    }
    load();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) router.replace('/login');
      setSession(nextSession);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [router]);

  return { session, access, officer, loading, error };
}
