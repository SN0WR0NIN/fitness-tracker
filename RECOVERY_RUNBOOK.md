# KG Stay Active — Backup & Recovery Runbook

This runbook covers recovery from the admin **Operational backup** JSON export. The export intentionally excludes passwords and Strava access/refresh tokens.

## 1. Before an incident

- Export an operational backup from **Admin → Export backup** after major scoring/settings changes and at regular challenge checkpoints.
- Keep the file in an access-controlled location.
- Validate the file before relying on it:
  ```bash
  npm run validate:backup -- /path/to/kg-backup-YYYY-MM-DD.json
  ```
- A successful export creates a `BACKUP_EXPORT` entry in the admin audit trail, so Command Centre can show the latest recorded backup.

## 2. Do not restore directly into production first

A restore is deliberately not exposed as a one-click web action. Recovery can overwrite valid scores and participant history, so it must be controlled.

1. Put the challenge into maintenance mode.
2. Take a fresh database snapshot/export of the damaged state for investigation.
3. Validate the chosen backup file.
4. Restore into a temporary/dev database first when possible.
5. Run the reconciliation checks below.
6. Only then apply the validated recovery to production.

## 3. Restore order

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
10. Admin audit entries, if needed for historical record

Do **not** replace current password hashes or Strava tokens from an operational backup; they are intentionally absent. Existing production credentials should remain untouched unless account recovery is separately required.

When restoring users, use stable IDs from the backup so Activity, profile settings, goals and WeeklyScore foreign keys remain valid. Use a transaction for each recovery batch and stop on any constraint conflict rather than skipping rows silently.

Older version-1 operational backups may not contain profile settings, weekly goals or ranking snapshots. The validator accepts those older backups, but recovery from them cannot recreate those optional experience/history records.

## 4. Required post-restore checks

The restore is not complete until all of these pass:

- Every Activity `userId` and `columnId` resolves to an existing row.
- Every WeeklyScore `userId` and `columnId` resolves.
- Profile settings and weekly goals reference existing users.
- There are no duplicate Activity IDs or duplicate Strava activity IDs.
- No WeeklyScore category or total is negative.
- Recomputed approved Activity totals equal the stored WeeklyScore totals for every participant/week/category.
- Approved activities have reviewer metadata.
- The public leaderboard totals match approved activities.
- Login, dashboard, activity submission, admin review, proof images, leaderboard and backup export all load normally.

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

## 5. If the restore fails

- Roll back the recovery transaction or restore the pre-recovery snapshot.
- Keep maintenance mode enabled.
- Do not repeatedly retry a partially applied import.
- Identify the first constraint/reconciliation failure, correct the recovery input or procedure, then retry from a clean database state.

## 6. Return to service

After validation:

1. Disable maintenance mode.
2. Load the public home page and leaderboard.
3. Log in as a normal participant and verify Dashboard and activity submission.
4. Log in as an admin and verify review queue, Command Centre health, weekly recap and backup export.
5. Record the recovery action in the admin audit trail with the incident/recovery details.
