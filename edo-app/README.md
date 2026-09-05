# KG EDO Tracker

Standalone Next.js application intended for a separate Vercel project. It deliberately lives under `edo-app/` so the existing KG Stay Active app is untouched.

## Vercel
- Repository: `SN0WR0NIN/fitness-tracker`
- Branch: `edo-tracker`
- Root Directory: `edo-app`
- Framework: Next.js

## Supabase
The frontend uses the dedicated empty Supabase project `otdmtwooipmvvsstyimq` and the `edo-command` Edge Function for writes and approvals.

Core rules implemented by the backend:
- Maximum balance 48h
- No negative balance
- Warning at 25h, critical at 40h
- A later Claim can move ahead of an overflowing Grant only within the same month
- Draft/Pending/Approved/Rejected states
- Monthly ledger projection and audit logging
