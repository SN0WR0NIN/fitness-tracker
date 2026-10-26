# Cycling scoring: new submissions only

Version 2 scores a single cycling session as `distance / 3 + 3 * floor(distance / 20)`, then floors the final total (including any existing eligible daily friend bonus) to one decimal place. Speed has no effect. The milestone repeats without a cap. Other sports retain their half-point flooring.

## Release ordering (requires separate deployment/database authorization)

1. Apply `prisma/cycling-scoring-version.sql` after `prisma/admin-score-overrides.sql` and before starting the new application code.
2. Apply `prisma/interval-run-backup.sql` after its interval and cycling prerequisites.
3. Deploy only after verification and explicit authorization. No production migration or deployment is performed by preparing this change.

The database default is **version 1**, so every existing row, old backup without a version, and historical import stays on legacy cycling arithmetic. Only `createActivity` stamps **version 2**, server-side, for new submissions once this code goes live. The rule is based on submission creation, not the entered workout date. Clients cannot choose or change the stored version. Corrections, review, rejection/reset, bonus redistribution and leaderboard rebuilds preserve it. New rows of any sport carry the version so later category corrections are consistent with their submission's rule set.

Existing saved scores are not bulk recalculated or migrated. Existing ledger behavior (including overrides and automatic friend allocation) remains in effect; version 1 cycling never receives the new distance milestone bonus. Historical-import entry points deliberately use version 1, even when importing after launch. Restore preserves explicit versions, and old archives safely default to version 1.

## Examples before eligible friend bonus

| Session km | Saved points |
|---:|---:|
| 15 | 5.0 |
| 19.99 | 6.6 |
| 20 | 9.6 |
| 40 | 19.3 |
| 60 | 29.0 |
| 80 | 38.6 |

Tests: `node scripts/cycling-scoring-tests.cjs` covers boundaries, repeating milestones, speed independence, raw-vs-display flooring, daily friend cap, overrides, legacy rebuilds/imports and stored-version explanations.
