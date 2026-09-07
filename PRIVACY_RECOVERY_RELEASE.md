# Privacy, recovery and operations release gate

**User will approve and deploy. Keep this PR draft/unmerged until review is complete.** Preparation performs no live migration, bucket/privacy toggle, billing change, production restore, score recalculation or synthetic live activity.

## Intended behavior
- Activity proofs: owner/admin only, including pending and rejected entries. Public activity/profile responses no longer expose proof references. Profile photos remain public.
- Private-image bytes go through an authenticated `private, no-store` proxy, never the shared image optimizer or an exposed reusable signed URL. Session/role checks are current; a known object URL cannot be attached by another participant to manufacture read permission. Newly uploaded drafts are scoped to their uploader; account-linked activity ownership takes precedence over the original path.
- Existing canonical local URLs remain stored as references, so no historical activity rewrite is needed. New uploads refuse an existing public proof bucket instead of silently weakening or changing it. New proof buckets are private.
- Drive/Strava links use an authenticated, allowlisted external redirect, not server-side arbitrary URL fetching. This restricts disclosure within the app; it cannot revoke public external URLs, previously cached bytes or downloaded copies. Unknown legacy providers fail closed and need owner review.
- Member/admin score descriptions use saved PointsLog values, never another scoring algorithm. Pending/rejected standings status is explicit. A zero recorded bonus is not falsely diagnosed as a particular cause when settings might have changed.
- `/admin/operations` supplies read-only bucket/backup observations, a handover guide and honest billing setup status. No green claim that provider alerts are enabled.

## Review and tests
Require exact-head build, changed-file lint, unit/security/backup tests, disposable-database restore drill and the full existing scoring/correction/review suite. Preserve existing assertions. No production datasets, images or secrets in CI. A synthetic fixture image is enabled only for explicit CI+E2E on loopback with no Vercel environment. PWA reliability is separate; do not claim it fixed here.

## Coordinated owner deployment
1. Review code/test evidence and revalidate the production release and backup. Agree a brief proof-upload interruption window; unrelated activities/scoring need no rule change.
2. Deploy the approved code **before** restricting the existing proof bucket. Test owner/admin access and member/anonymous denial using genuine authorized entries, without creating synthetic production activities. Until the bucket is private, old public object URLs remain readable independently of the app.
3. With separate explicit storage-change approval, make **activity-proofs private** using the Supabase dashboard/Storage API. Leave **profile-photos unchanged**. Verify private source access, proxy access, and denied anonymous/unrelated-user reads. Review/correct any client-role storage SELECT policy that permits direct private reads. Do not use SQL updates to Storage metadata as an object operation.
4. Verify new uploads, drafts, admin-created entries, corrections and account-linked historical proofs in a disposable environment before the live transition. Verify operational settings and image support after it.
5. Account separately for public-cache exposure. The old uploader requested a long browser cache TTL; changing bucket privacy cannot revoke downloaded browser copies. Signed token expiry alone does not guarantee CDN eviction. An incident may require separately approved object rotation/provider invalidation and external-provider permission work. Do not delete evidence without a backup and approval.
6. Review and separately approve `prisma/points-log-backup-v7.sql` for future scheduled snapshots. Do not rerun the previous achievement migration or historical recalculation. Create one approved private v7 snapshot, verify checksum/counts/contents after commit, and verify the independent object archive/off-site copy. No automatic migration runs at app startup.
7. Configure billing in the provider console using BILLING_ALERTS.md and a user-selected USD amount; explicitly review pause behavior. This cannot be completed through application deployment alone.
8. Record exact deployed SHA, privacy checks, v7 migration/checksum evidence, billing owner choices and recovery drill result. The `master` deployment must not be claimed private/recoverable/budget-protected before these checks actually pass.

## Rollback
Do not roll back to direct-public-URL display code with a private bucket and then re-publicize the bucket as a workaround. Prefer a compatible forward fix; any temporary functionality change requires owner review. Stored v6 snapshots remain unchanged; retain the v6 validator and old source. Rolling back app code does not restore data or media.

## External evidence inventory observed during preparation
A read-only metadata check found 34 local Supabase proof references, 58 Google Drive references and one Strava-hosted image reference. These are time-scoped counts, not current inventory guarantees; no image bytes or participant details were fetched. External-provider privacy and off-site copies remain owner tasks.

Primary references reviewed 7 September 2026:
- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://supabase.com/docs/guides/storage/cdn/smart-cdn
- https://supabase.com/docs/guides/platform/backups
- https://vercel.com/docs/spend-management
