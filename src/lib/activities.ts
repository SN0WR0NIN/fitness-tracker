import { assertAttachableProofs, normalizeProofUrls } from './proof-access';
import { Prisma, type Activity } from '@prisma/client';
import { resolveActivityFriends } from './activity-friends';
import { activityFriendIds } from './friend-selection';
import { duplicateReason, DuplicateApprovalError, ActivityEditError } from './activity-duplicates';
import { calculateActivityPoints, resolveEffectiveCategory, getWeekStart, getWeekNumber, normalizeRunSegments, summarizeRunSegments, type ActivityCategory, type RunSegment, type ScoringRules } from './scoring';
import { scoringTransaction, ledgerSettings, reconcileParticipantScores } from './scoring-ledger';
import { assertCompetitionWritable } from './operating-mode';
import { assertActivityWeekWritable } from './week-finalization';

interface CreateActivityInput {
  userId: string; columnId: string; proofActorId?: string; category: ActivityCategory; distance?: number; pace?: number;
  runSegments?: RunSegment[];
  companionUserId?: string; companionUserIds?: string[]; proofUrl?: string; proofUrls?: string[]; stravaActivityId?: string;
  occurredAt?: Date; mapPolyline?: string; elevationGain?: number; duration?: number;
}

export async function createActivity(input: CreateActivityInput) {
  return scoringTransaction(async tx => {
    await assertCompetitionWritable(tx);
    const proofUrls = normalizeProofUrls(input.proofUrls, input.proofUrl);
    await assertAttachableProofs(tx, proofUrls, input.proofActorId ?? input.userId);
    const settings = await ledgerSettings(tx);
    const runSegments = input.category === 'RUN' ? normalizeRunSegments(input.runSegments) : [];
    const runMetrics = runSegments.length ? summarizeRunSegments(runSegments) : null;
    const distance = runMetrics?.distance ?? input.distance;
    const pace = runMetrics?.pace ?? input.pace;
    const category = resolveEffectiveCategory(input.category, pace, settings.rules);
    const friends = await resolveActivityFriends(tx, input.userId, input);
    const occurredAt = input.occurredAt ?? new Date();
    const weekNumber = getWeekNumber(occurredAt, settings.startDate);
    await assertActivityWeekWritable(tx, occurredAt, weekNumber);
    const created = await tx.activity.create({ data: {
      userId: input.userId, columnId: input.columnId, category,
      distance: category === 'TROOP_GAMES' ? (distance ?? 0) : distance!, pace,
      ...(runSegments.length ? { runSegments: runSegments as Prisma.InputJsonValue } : {}),
      ...friends, proofUrls, proofUrl: proofUrls[0] ?? input.proofUrl, stravaActivityId: input.stravaActivityId,
      mapPolyline: input.mapPolyline, elevationGain: input.elevationGain, duration: input.duration,
      points: calculateActivityPoints({ category, distance, pace, runSegments }, settings.rules).totalPoints,
      status: 'PENDING', occurredAt, weekStart: getWeekStart(occurredAt), weekNumber,
    } });
    await reconcileParticipantScores(tx, input.userId, settings);
    return tx.activity.findUniqueOrThrow({ where: { id: created.id } });
  });
}

async function changeActivity(activityId: string, change: (tx: Prisma.TransactionClient, activity: Activity) => Promise<void>) {
  return scoringTransaction(async tx => {
    await assertCompetitionWritable(tx);
    const rows = await tx.$queryRaw<Activity[]>`SELECT * FROM "Activity" WHERE id=${activityId} FOR UPDATE`;
    const activity = rows[0];
    if (!activity) throw new ActivityEditError('Activity not found.', 404);
    await assertActivityWeekWritable(tx, activity.occurredAt, activity.weekNumber);
    await change(tx, activity);
    await reconcileParticipantScores(tx, activity.userId);
    return tx.activity.findUniqueOrThrow({ where: { id: activityId } });
  });
}

export async function approveActivity(activityId: string, reviewerId: string, duplicateOverrideReason?: string) {
  return changeActivity(activityId, async (tx, activity) => {
    if (activity.status === 'APPROVED') return;
    const candidates = await tx.activity.findMany({ where: { userId: activity.userId, id: { not: activity.id }, status: { not: 'REJECTED' } } });
    const matches = candidates.flatMap(other => { const reason = duplicateReason(activity, other); return reason ? [{ id: other.id, reason }] : []; });
    if (matches.length && !duplicateOverrideReason?.trim()) throw new DuplicateApprovalError(matches);
    await tx.activity.update({ where: { id: activityId }, data: {
      status: 'APPROVED', reviewedById: reviewerId, reviewedAt: new Date(), rejectionReason: null,
    } });
  });
}

export async function rejectActivity(activityId: string, reviewerId: string, reason?: string) {
  return changeActivity(activityId, async (tx, activity) => {
    if (activity.status === 'REJECTED') return;
    await tx.activity.update({ where: { id: activityId }, data: {
      status: 'REJECTED', reviewedById: reviewerId, reviewedAt: new Date(), rejectionReason: reason,
    } });
  });
}

export async function resetActivityToPending(activityId: string) {
  return changeActivity(activityId, async (tx, activity) => {
    if (activity.status === 'PENDING') return;
    await tx.activity.update({ where: { id: activityId }, data: {
      status: 'PENDING', reviewedById: null, reviewedAt: null, rejectionReason: null,
    } });
  });
}

interface UpdateActivityInput {
  category?: ActivityCategory; distance?: number; pace?: number | null; proofUrl?: string | null; proofUrls?: string[];
  runSegments?: RunSegment[] | null;
  companionUserId?: string | null; companionUserIds?: string[]; companionName?: string | null;
  basePointsOverride?: number | null; totalPointsOverride?: number | null;
}

function replacePrimaryProof(activity: Pick<Activity, 'proofUrl' | 'proofUrls'>, primary: string | null): string[] {
  const current = normalizeProofUrls(activity.proofUrls, activity.proofUrl);
  const secondary = current.filter(value => value !== activity.proofUrl && value !== primary);
  return primary ? normalizeProofUrls([primary, ...secondary]).slice(0, 5) : secondary.slice(0, 5);
}

export async function updateActivity(activityId: string, input: UpdateActivityInput, ownerId?: string) {
  return changeActivity(activityId, async (tx, activity) => {
    if (ownerId && activity.userId !== ownerId) throw new ActivityEditError('Not your activity', 403);
    if (ownerId && activity.status !== 'PENDING') throw new ActivityEditError('This submission has been reviewed. Refresh to see its status.', 409);
    if (ownerId && (input.basePointsOverride !== undefined || input.totalPointsOverride !== undefined)) {
      throw new ActivityEditError('Only administrators can override saved points.', 403);
    }
    if (ownerId) await assertCompetitionWritable(tx, true);
    const proofChange = input.proofUrls !== undefined || input.proofUrl !== undefined;
    if (ownerId && activity.stravaActivityId && (input.category !== undefined || input.distance !== undefined || input.pace !== undefined || proofChange)) {
      throw new ActivityEditError('Strava workout details must be corrected in Strava. You can update friends here.', 400);
    }
    let nextProofUrls = normalizeProofUrls(activity.proofUrls, activity.proofUrl);
    if (input.proofUrls !== undefined) nextProofUrls = normalizeProofUrls(input.proofUrls);
    else if (input.proofUrl !== undefined) nextProofUrls = replacePrimaryProof(activity, input.proofUrl);
    if (ownerId && proofChange) {
      await assertAttachableProofs(tx, nextProofUrls, ownerId, normalizeProofUrls(activity.proofUrls, activity.proofUrl));
    }
    const settings = await ledgerSettings(tx);
    const requestedCategory = input.category ?? activity.category;
    const storedRunSegments = normalizeRunSegments(activity.runSegments);
    const metricsChanged = input.category !== undefined && input.category !== activity.category
      || input.distance !== undefined && input.distance !== activity.distance
      || input.pace !== undefined && input.pace !== activity.pace;
    const runSegments = requestedCategory === 'RUN'
      ? input.runSegments !== undefined
        ? normalizeRunSegments(input.runSegments)
        : metricsChanged ? [] : storedRunSegments
      : [];
    const runMetrics = runSegments.length ? summarizeRunSegments(runSegments) : null;
    const distance = requestedCategory === 'TROOP_GAMES' ? 0 : runMetrics?.distance ?? input.distance ?? activity.distance;
    const pace = requestedCategory === 'RUN' ? runMetrics?.pace ?? (input.pace === undefined ? activity.pace : input.pace) : null;
    const category = resolveEffectiveCategory(requestedCategory, pace ?? undefined, settings.rules);
    let friends = { companionUserIds: activityFriendIds(activity), companionUserId: activity.companionUserId,
      companion: activity.companion, completedWithFriend: activity.completedWithFriend };
    if (input.companionUserIds !== undefined || input.companionUserId !== undefined) {
      friends = await resolveActivityFriends(tx, activity.userId, input);
    } else if (input.companionName !== undefined) {
      const companion = input.companionName?.trim() || null;
      friends = { companionUserIds: [], companionUserId: null, companion, completedWithFriend: Boolean(companion) };
    }
    await tx.activity.update({ where: { id: activityId }, data: {
      category, distance,
      pace,
      ...(input.runSegments !== undefined || metricsChanged || storedRunSegments.length ? { runSegments: runSegments.length ? runSegments as Prisma.InputJsonValue : Prisma.DbNull } : {}),
      ...(proofChange ? { proofUrls: nextProofUrls, proofUrl: nextProofUrls[0] ?? null } : {}),
      ...friends,
      basePointsOverride: input.basePointsOverride,
      totalPointsOverride: input.totalPointsOverride,
    } });
  });
}

/** Explicit admin scoring rebuild, including past daily bonus allocations.
 * The caller's existing backup/audit workflow remains responsible for rollout. */
export async function recalculateAllScores(rules: ScoringRules, periodStart: Date) {
  return scoringTransaction(async tx => {
    await assertCompetitionWritable(tx);
    const users = await tx.user.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
    let activities = 0; let weeklyScores = 0;
    for (const user of users) {
      const result = await reconcileParticipantScores(tx, user.id, { rules, startDate: periodStart });
      activities += result.activities; weeklyScores += result.weeklyScores;
    }
    return { activities, weeklyScores };
  });
}
