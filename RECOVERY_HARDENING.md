# Recovery hardening and isolated drill

## What is included
The v7 **fresh admin JSON export** uses one read-only repeatable-read transaction and includes PointsLog. It preserves exported activities, score breakdowns, weekly totals/results, achievement/notification history and the other documented operational collections. Credentials are excluded. JSON still contains personal data: store it privately.

`prisma/points-log-backup-v7.sql` adds a final enrichment trigger for **future stored snapshots**. Apply only after separate migration approval; it does not rewrite existing snapshots or backfill scores. The existing v6 validator is retained for historical snapshots. The v7 validator requires one matching PointsLog per activity and rejects missing/mismatched totals rather than guessing from a rounded base value. Verify checksum, counts, contents and a restore, not just file existence.

The fresh exporter records all 19 array collection counts; scheduled enrichment adds PointsLog to the existing recorded-count format. The number of recorded counters is not a backup-quality score.

## What is not included
Binary proof images/profile photos, provider settings, role passwords, external Drive/Strava bytes, and complete service configuration are not included. Supabase database backups also exclude Storage object bytes. The operational snapshot is not a provider/full/off-site backup. Source code and deployment settings need their own private recovery record. A proof reference is not an image backup.

## Synthetic CI restore drill
`scripts/restore-operational-drill.cjs` is deliberately **not a production restore tool**. It refuses a non-empty target, any non-loopback destination, Vercel environments, missing CI/E2E markers, the normal E2E database, non-v7 data or users outside example.test. It accepts only the dedicated `fitness_tracker_restore_drill` database with `--confirm-disposable`. It never uses DATABASE_URL as a fallback destination.

The CI job copies only the source fixture schema into the empty target using the PostgreSQL service container, then imports synthetic exported rows into a fixed table allowlist. All values are parameters. User triggers are disabled only in the isolated target and re-enabled within the same rollbackable transaction; FK/check/unique constraints remain active. This preserves historical notification/achievement state without replaying notifications. Restored accounts receive unknown random passwords, must-change-password and fresh-session flags; both operating modes are locked. Row equivalence/counts and a fresh post-commit read are checked. A second attempt against the populated target must fail.

This proves the exercised fixture restore path, not production recoverability or external media retrieval. An actual recovery rehearsal requires owner approval, a private independent target, defined RPO/RTO and validation of production-format differences. Never relax these CLI guards to point this drill at production.

## Image archive, separately
The offline `scripts/media-archive.cjs` packs **already authorized, privately copied** objects. It does not fetch live buckets, credentials, or external URLs. Obtain object copies using the provider's supported API/CLI with the owner and preserve the bucket/key mapping:

```
private-source/activity-proofs/<object key>
private-source/profile-photos/<object key>
node scripts/media-archive.cjs pack /private/source /private/new-archive
node scripts/media-archive.cjs verify /private/new-archive
```

The new archive is owner-only on POSIX, uses content-addressed blobs plus SHA-256 manifest/object checks, rejects symlinks/path traversal and missing/tampered objects. It does **not encrypt** data or prove the copied objects cover a live bucket. Keep the manifest digest in a separate trusted private record; checksums alone do not authenticate an attacker-modified archive. Use an approved encrypted off-site store and separate key custodian; neither destination nor retention is chosen automatically here. Never publish these archives as CI artifacts.

Before real recovery compare the archived object inventory with the provider's source inventory, match every required activity/profile reference, and account for legacy external links. Restore objects via the provider Storage API, not SQL changes to storage.objects. Validate hashes and permissions in the isolated target. Fixture tests cover packaging, tampering and rejection paths; no live images are copied by CI.

Primary references reviewed 7 September 2026:
- https://supabase.com/docs/guides/platform/backups (database backups exclude Storage objects)
- https://supabase.com/docs/guides/storage/schema/design (use Storage APIs for object writes)
