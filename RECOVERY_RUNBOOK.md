# KG Stay Active — Backup & Recovery Runbook

This runbook covers recovery from the admin **Operational backup** JSON export and the automated private operational snapshots. Both intentionally exclude passwords and Strava access/refresh tokens.

## 1. Safety layers

The app has three complementary safety layers:

1. **Hourly integrity check** — Supabase Cron runs `app_internal.run_integrity_check()` at minute 10 of every hour. Results are stored privately for 90 days and surfaced in Command Centre.
2. **Daily operational snapshot** — Supabase Cron runs `app_internal.create_operational_backup()` at 18:30 UTC (02:30 Singapore time). Snapshots are stored privately for 30 days with a SHA-256 checksum and row counts.
3. **Provider database backups** — platform-level database backups protect against broader database incidents. The app-level operational snapshots are intended mainly for fast recovery from bad edits, imports, score changes or accidental deletes.

The private `app_internal` schema is not granted to `anon` or `authenticated`. Automated snapshots can be downloaded only through the admin-protected **Download auto backup** action.

## 2. Before an incident

- Check **Admin → Automated safety net** for the most recent integrity status and automatic snapshot.
- Use **Download auto backup** to save the latest scheduled snapshot when needed.
- Continue using **Fresh backup now** before major scoring/settings/import changes; that export is also recorded in the admin audit trail.
- Keep downloaded backup files in an access-controlled location.
- Validate a downloaded file before relying on it:
  ```bash
  npm run validate:backup -- /path/to/kg-backup-YYYY-MM-DD.json
  ```

## 3. Do not restore directly into production first

A restore is deliberately not exposed as a one-click web action. Recovery can overwrite valid scores and participant history, so it must be controlled.

1. Put the challenge into maintenance mode.
2. Take/download a fresh snapshot of the damaged state for investigation.
3. Choose the last known-good automatic or manual operational backup.
4. Validate the chosen backup file.
5. Restore into a temporary/dev database first when possible.
6. Run the reconciliation checks below.
7. Only then apply the validated recovery to production.

## 4. Restore order

Restore records in dependency order:

1. Challenge settings
2. Columns
3. Users (identity/profile fields only)
4. User profile settings
5. Announcements
6. Activities
7. Weekly scores
8. Weekly-goal history
9. Ranking snapshots
10. Duplicate-review decisions
11. Finalized weekly results
12. Persistent user notifications
13. Admin audit entries, if needed for historical record

Do **not** replace current password hashes or Strava tokens from an operational backup; they are intentionally absent. Existing production credentials should remain untouched unless account recovery is separately required.

When restoring users, use stable IDs from the backup so Activity, profile settings, goals, notifications and WeeklyScore foreign keys remain valid. Use a transaction for each recovery batch and stop on any constraint conflict rather than skipping rows silently.

Backup format history:

- **Version 1** — core challenge data; some profile/history collections may be absent.
- **Version 2** — automatic private snapshots add profile settings, weekly goals and ranking snapshots.
- **Version 3** — duplicate-review decisions are included.
- **Version 4** — finalized weekly competition results and persistent notifications are also included.

The validator accepts versions 1–4, but an older backup cannot recreate collections that did not yet exist in that version.

## 5. Required post-restore checks

The restore is not complete until all of these pass:

- Every Activity `userId` and `columnId` resolves to an existing row.
- Every WeeklyScore `userId` and `columnId` resolves.
- Profile settings and weekly goals reference existing users.
- Duplicate-review decisions reference valid Activity records.
- Finalized weekly-result awards reference valid users or columns.
- Persistent notifications reference valid users and have unique dedupe keys.
- There are no duplicate Activity IDs or duplicate Strava activity IDs.
- No WeeklyScore category or total is negative.
- Recomputed approved Activity totals equal the stored WeeklyScore totals for every participant/week/category.
- Approved activities have reviewer metadata.
- Rejected activities have a rejection reason.
- No activity falls outside the configured challenge window.
- The public leaderboard totals match approved activities.
- The public **Weekly Results** page loads the restored finalized history.
- The authenticated **Notification Centre** loads restored weekly-award/result notifications.
- Login, dashboard, activity submission, admin review, proof images, leaderboard and backup download/export all load normally.
- The next scheduled integrity check records `HEALTHY` or only known review-only duplicate warnings.

### Score reconciliation SQL

```sql
WITH expected AS (
  SELECT a."userId", a."weekStart",
    COALESCE(SUM(a.points), 0) AS total,
    COALESCE(SUM(a.points) FILTER (WHERE a.category='RUN'), 0) AS run,
    COALESCE(SUM(a.points) FILTER (WHERE a.category='CYCLE'), 0) AS cycle,
    COALESCE(SUM(a.points) FILTER (WHERE a.category='SWIM'), 0) AS swim,
    COALESCE(SUM(a.points) FILTER (WHERE a.category='WALK_OR_HIKE'), 0) AS hike,
    COALESCE(SUM(a.points) FILTER (WHERE a.category='TROOP_GAMES'), 0) AS troop
  FROM "Activity" a
  WHERE a.status='APPROVED'
  GROUP BY a."userId", a."weekStart"
)
SELECT COALESCE(e."userId", w."userId") AS "userId",
       COALESCE(e."weekStart", w."weekStart") AS "weekStart"
FROM expected e
FULL OUTER JOIN "WeeklyScore" w
  ON w."userId"=e."userId" AND w."weekStart"=e."weekStart"
WHERE COALESCE(e.total,0) <> COALESCE(w."totalPoints",0)
   OR COALESCE(e.run,0) <> COALESCE(w."runPoints",0)
   OR COALESCE(e.cycle,0) <> COALESCE(w."cyclePoints",0)
   OR COALESCE(e.swim,0) <> COALESCE(w."swimPoints",0)
   OR COALESCE(e.hike,0) <> COALESCE(w."hikePoints",0)
   OR COALESCE(e.troop,0) <> COALESCE(w."troopGamePoints",0);
```

A healthy result is **zero rows**.

## 6. Weekly competition recovery

Finalized weekly results are reproducible from approved Activity records. If a restored weekly result is missing or a late correction changed a completed week:

1. Reconcile Activity and WeeklyScore first.
2. Open **Admin → Weekly Awards**.
3. Select the affected completed week.
4. Choose **Rebuild week**.
5. Verify the public Results page and winner notifications.

A rebuild refreshes the finalized standings, awards, and persistent weekly-result/award notifications for that week. It does not change Activity scoring.

## 7. If the restore fails

- Roll back the recovery transaction or restore the pre-recovery snapshot.
- Keep maintenance mode enabled.
- Do not repeatedly retry a partially applied import.
- Identify the first constraint/reconciliation failure, correct the recovery input or procedure, then retry from a clean database state.

## 8. Return to service

After validation:

1. Disable maintenance mode.
2. Load the public home page, leaderboard and Weekly Results page.
3. Log in as a normal participant and verify Dashboard, Notification Centre and activity submission.
4. Log in as an admin and verify review queue, Command Centre safety status, Weekly Awards, weekly recap and backup download/export.
5. Confirm the next hourly integrity check and weekly-finalization scheduler complete normally.
6. Record the recovery action in the admin audit trail with the incident/recovery details.
