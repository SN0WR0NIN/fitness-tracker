# Focused five-feature release

Scope: achievement milestones, reviewed activity corrections, account notification preferences, operating controls, and installable PWA polish. No bonus scoring, email delivery, push subscription service, or unrelated competition feature is introduced.

## Automated evidence

`npx playwright test --config=playwright.config.cjs` includes the original tests and the focused-controls, focused-achievement-metrics and focused-pwa suites. Mutation fixtures require all of `CI=true`, `E2E_TEST_MODE=1`, the exact localhost `fitness_tracker_e2e` database, and a localhost app. They do not accept deployment URLs or production database hosts.

Coverage includes owner isolation; unchanged scoring before review; correction approval, rejection, cancellation, stale requests, repeat/concurrent decisions and duplicate overrides; week/category reconciliation and leaderboard totals; notification filtering, saved preferences and essential notices; confirmed lock changes and secure unlock; direct database write protection; approved-only badges, reversal, silent backfill, completed-week goal streaks and weekly-result invalidation; version-6 backup fields, checksums and malformed-backup rejection.

PWA coverage includes real Chromium service-worker registration, offline navigation, cache contents, manifest/icon requests, controlled install/update events, and iPad detection. Controlled browser events do not prove that every physical phone's operating-system installation UI works. Verify that separately on the target Android and iPhone/iPad devices.

## Before production

1. Keep PR #55 unmerged until its checks have passed for the exact head commit.
2. Read production schema/migration history and operating state first. Do not re-run CREATE TABLE scripts against an already migrated database.
3. Take a private operational snapshot. Do not commit or attach participant backups to GitHub.
4. Review and apply `prisma/focused-controls.sql`, then `prisma/achievement-engine.sql` using the migration mechanism. These files are migrations, not request-time code. Backfill is silent. Leave maintenance/read-only flags as they were; this release must not activate a production lock.
5. Confirm private tables have RLS enabled and no anon/authenticated privileges. Confirm the achievement scheduler is active and the latest snapshot is version 6 with a valid checksum.
6. Promote the reviewed app commit; verify deployment identity, public pages and authorization, then reconcile scores and assess fresh telemetry. A preview build alone is not release validation.

## Finding the controls

- Approved activity: **My activities → Request correction**. The original stays scored until an admin decision. A changed source record makes an approval attempt stale rather than overwriting it.
- Participant history: `/corrections`.
- Admin review: **Admin → Activities → Correction requests**.
- Notifications: `/account/notifications`. Preferences filter the bell and Notification Centre. Security/maintenance notices are not optional.
- Operating controls: **Admin → System → Maintenance controls**. Normal enables operations. Paused stops member submissions/imports and related activity changes but keeps admin review available. Read-only stops competition writes, including admin activity changes. Authentication, password recovery, viewing and the dedicated admin unlock endpoint remain available.
- Installation: `/install`; account links also expose installation and preferences. Updates wait for confirmation. Offline mode does not claim a successful submission.

## Recovery

Both manual and scheduled operational exports use version 6 and include correction history, preferences, achievement definitions/progress and weekly-result rebuild markers. Run `npm run validate:backup -- /path/to/backup.json`; v1-v5 checks remain supported. The validator does not restore anything. It rejects malformed new records and secret fields. Proof URLs are references, not copies of uploaded image bytes.

For an application-only rollback, restore the prior known-good app deployment and leave additive private data intact. Database triggers remain active until explicitly reviewed in a recovery plan; an app rollback does not remove them. Never drop the new tables as an automatic rollback or disable security controls to make a test pass.
