# Multiple friends per activity

The member submission, pending editor, admin create/editor and approved-activity correction forms share a searchable checkbox picker. The server accepts `companionUserIds` and still accepts legacy `companionUserId` payloads from older clients/queued drafts. It validates every selected friend, rejects self-selection, and deduplicates IDs. Names are recorded together in the existing display field.

The configured friend bonus is earned once per participant, Singapore calendar day and eligible sport (Run, Cycle, Swim, Walk/Hike). With the current +3 setting, the maximum daily bonus is +12. It is never paid again for a repeated sport, extra friends or Troop Games. No additional activity, points or alert is created for a selected friend. Social achievements still count approved activities, not people.

Apply `prisma/multiple-activity-friends.sql` via the migration mechanism before deploying the Prisma client that reads the new column. The migration is additive and does not update existing activity records, timestamps, goals, scores or operating mode. Existing single-friend records fall back to their legacy ID. Keep production Normal and take a private backup before rollout. The new internal functions are invoker functions with no client EXECUTE permissions; Activity's existing RLS is unchanged.

Manual and automatic v6 backups carry the optional `companionUserIds` field; earlier v6 exports remain valid. Approved correction snapshots retain the full selection and a stale request cannot overwrite a newer activity. Pending and admin editors preserve selections when changing other fields. An account still referenced by a multi-friend activity cannot be deleted until its selections are reviewed; historical account linking transfers all references.

Regression tests use only the disposable localhost CI database and synthetic members. Never use production activities or maintenance toggles as test fixtures.
