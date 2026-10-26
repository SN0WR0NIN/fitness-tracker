# Interval and new-entry cycling review verification

Based on master `67cc763a55044ceb5a04979a8ce2b93ff121c13d` and PR #81 interval source `7e58c17b4b038688e723c379a52392cbe51fe16f`.

Passed locally: dependency install; Prisma generation/validation; hardening, correction interval, backup/export, and cycling regression suites; actual historical writer and ledger with in-memory transaction doubles; Next route type generation; TypeScript; production Next build; Playwright discovery (39 tests/20 files); diff whitespace checks. No production environment or database was used.

Full repository lint is not clean: 165 errors/5 warnings, versus 167 errors/5 warnings on unchanged master with the same dependencies. No file has an increased error count. Existing historical standalone runners are not green: historical-import expects obsolete zero slow-run points; historical-import-writer has an unresolved alias in its old loader. New regression runners cover relevant paths without weakening production checks.

Not executed locally: browser E2E, real PostgreSQL integration, scheduled SQL snapshot and restore drill. This executor has no PostgreSQL server/docker or dedicated Clerk development credentials. The existing CI workflow uses disposable localhost PostgreSQL and rejects production Clerk keys; it includes new correction, backup/version, and restore assertions.

Original #81 workflow run 35422527848 reports failure, but GitHub returns no jobs/attempt jobs; the exact failed step could not be established.

## Preview safety

The Vercel project's single DATABASE_URL variable targets both production and preview. This review branch therefore explicitly disables automatic Git deployments for `codex/pr81-interval-cycling-review` in vercel.json. Other branches retain their existing deployment policy. Do not manually deploy this branch against that shared database. An isolated preview database and separately authorized migration/release are prerequisites for live preview verification. No production migrations, score recomputation, deployment, merge, or credential changes are included in this work.
