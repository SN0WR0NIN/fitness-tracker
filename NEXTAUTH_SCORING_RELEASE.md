# Scoring-only release with existing NextAuth login

Target branch: `season-2026-legacy`. Do not merge or deploy the Clerk-based PR #82 or `master` for this release.

## Source provenance

The existing production CLI deployment, `dpl_2mjwxtn5S2kbtTab3e2mmd7mxMd2`, has no Git SHA metadata. Its application source was verified against `7e58c17b4b038688e723c379a52392cbe51fe16f` and recovered from Vercel's authenticated Source viewer. That commit already contains interval runs and descends directly from the production branch's `a7bd4b3d8d99f2f907752a367f22688602d4c45f`, without the Clerk commit in its ancestry.

Six live-only source changes are preserved: the proof-requirement helper, create/edit activity logic and activity API, participant Work/Recovery proof slots, administrator review, and their hardening tests. Of 104 live app text files, 103 match the baseline exactly and the activity API contains the recovered two-proof validation. Other available deployed application/configuration/dependency/schema/test hashes match the reconstructed baseline. Repository metadata/duplicate editor skill files are not runtime evidence.

Authentication routes, NextAuth options, password/session/recovery behavior, dependencies and proxy remain unchanged. No Clerk SDK or runtime is included, and no production environment variable or account should be changed. Existing database columns unrelated to scoring are retained.

## Feature behavior

- New cycling submissions use `distance / 3 + 3 * floor(distance / 20)`, no speed bonus, with final totals truncated to 0.1 points.
- Existing entries and historical imports remain scoring version 1 across corrections and rebuilds. Other sports retain half-point flooring.
- Interval corrections preserve Work/Recovery segments unless conversion is explicit. Existing two-distinct-proof requirements remain enforced.
- History, score explanations, private backup/export and isolated restore preserve segments, scoring versions, all proof references and score overrides.

## Validation and release gate

The review branch has automatic Vercel deployment disabled because preview and production share the database binding. CI uses only synthetic records in a disposable local PostgreSQL service; no production data is cloned. Require the full NextAuth credentials/session/recovery browser suite, feature regressions, populated legacy-schema migration rehearsal, scheduled backup checksum verification and isolated restore before release. Older Clerk-based CI is not evidence for this branch.

After a fresh production baseline and private backup, apply only `prisma/cycling-scoring-version.sql` and `prisma/interval-run-backup.sql`. Do not replay incomplete historical migrations. Neither migration recalculates scores. Verify all pre-existing activity fields and ledger values are unchanged and every old row has version 1.

Keep the existing database-backed read-only competition mode active through migration, production deployment and verification of the actual aliases/release SHA and an existing real account. Restore the prior mode only after preservation and account checks pass. No production test submissions or retroactive scoring.

## Recovery rule

Before any version-2 writes, the exact prior NextAuth deployment can be restored while scoring writes are paused; leave additive schema intact. After version-2 writes exist, a version-unaware old application must not reopen for writes. Prefer a tested version-aware roll-forward; any emergency app rollback stays read-only. Never drop version columns or restore an old snapshot over newer records.
