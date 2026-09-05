import { createClient } from '@supabase/supabase-js';

const fallbackUrl = 'https://otdmtwooipmvvsstyimq.supabase.co';
const fallbackPublishableKey = 'sb_publishable_4OptbGU5c0zgJdzSeseuPw_N_v_sr2w';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? fallbackUrl,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? fallbackPublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
