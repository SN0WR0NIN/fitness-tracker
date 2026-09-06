# Daily friend bonus correction

The participant receives the configured +3 bonus once per Singapore calendar day per eligible sport: RUN, CYCLE, SWIM and WALK_OR_HIKE. The current daily maximum is +12. Troop Games retains its fixed session score with no friend bonus. A slow run scored as walking uses the walking allowance. A below-minimum walk cannot claim a bonus. Additional friends, different friends, repeated activities, admin-created entries and replayed approvals do not multiply bonuses.

Approved entries claim first; within a status, chronological activity time, then creation time and id provide a deterministic allocation. Pending points are estimates and never included in standings. Reject/reset/clear/correct operations reallocate to the next eligible entry inside the same serializable transaction. Final totals and PointsLog breakdowns are rebuilt from activities, not blindly incremented. Correction requests still change nothing until approved. Existing result-dirty and achievement rules remain active.

## Achievement safety

Apply `prisma/achievement-final-state.sql` through the migration mechanism BEFORE releasing this scoring change. It replaces the three immediate achievement triggers with deferrable, initially deferred row triggers using the existing private invoker functions. Evaluation happens before COMMIT completes, after the final bonus allocation. It prevents a temporary 102-to-99 transition from consuming a never-earned milestone alert, and a temporary 100-to-97-to-100 transition from removing an earned alert. Rollbacks discard deferred checks. Existing dedupe history, access restrictions, scoring, columns, and operating mode are unchanged by the migration itself. No runtime DDL is added.

Regression scenarios use the real correction, historical-import, account-linking and admin-edit APIs. They assert final 99-point totals have no first-earned, notified, or revoked timestamps, a later genuine 100-point result produces exactly one notification, and a still-earned badge retains its original notification through a bonus transfer. The older rollback-only metrics fixture explicitly flushes deferred constraints at its assertion boundaries; HTTP scenarios exercise real commits.

## Controlled production rollout

No production access or deployment is implied by a passing preview. Before live changes: inspect current integrity and a read-only historical adjustment preview, take a fresh private operational backup and verify its checksum, apply the trigger-timing migration, then release the tested app and run the confirmed scoring reconciliation. Rebuild any finalized weekly results flagged dirty, and verify approved totals, per-sport/day caps, achievements and backup freshness afterward. Take the post-reconciliation backup in a separate transaction after reconciliation commits so deferred achievement updates are included.

Historical records are not silently deleted. Do not claim old standings are corrected until the full reconciliation succeeds. Mutation tests use only the disposable localhost CI database/app, never live participants or workouts. The unchanged PWA offline reliability issue is separate and must be reported honestly if it recurs.
