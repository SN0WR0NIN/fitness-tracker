import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { duplicateReason } from '@/lib/activity-duplicates';
import { prisma } from '@/lib/prisma';

export type DuplicateDecisionStatus = 'DIFFERENT' | 'DUPLICATE' | 'LATER';

export type DuplicateReviewActivity = {
  id: string;
  userId: string;
  columnId: string;
  category: 'RUN' | 'CYCLE' | 'SWIM' | 'WALK_OR_HIKE' | 'TROOP_GAMES';
  distance: number;
  pace: number | null;
  duration: number | null;
  elevationGain: number | null;
  points: number;
  completedWithFriend: boolean;
  companion: string | null;
  proofUrl: string | null;
  stravaActivityId: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  occurredAt: Date;
  createdAt: Date;
  reviewedAt: Date | null;
  user: { id: string; name: string };
  column: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
};

export type DuplicateReviewDecision = {
  pairKey: string;
  activityAId: string;
  activityBId: string;
  status: DuplicateDecisionStatus;
  duplicateActivityId: string | null;
  keptActivityId: string | null;
  note: string | null;
  reviewedById: string | null;
  reviewedByName: string;
  reviewedAt: Date;
  updatedAt: Date;
};

export type DuplicateReviewPair = {
  pairKey: string;
  reason: string;
  activityA: DuplicateReviewActivity;
  activityB: DuplicateReviewActivity;
  decision: DuplicateReviewDecision | null;
};

export type DuplicateReviewCentreData = {
  open: DuplicateReviewPair[];
  later: DuplicateReviewPair[];
  resolved: DuplicateReviewPair[];
};

export class DuplicateReviewError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const categoryScoreField = {
  RUN: 'runPoints',
  CYCLE: 'cyclePoints',
  SWIM: 'swimPoints',
  WALK_OR_HIKE: 'hikePoints',
  TROOP_GAMES: 'troopGamePoints',
} as const;

export function duplicatePairKey(activityAId: string, activityBId: string) {
  const [a, b] = [activityAId, activityBId].sort();
  return `${a}:${b}`;
}

function orderedPair<T extends { id: string }>(a: T, b: T): [T, T] {
  return a.id < b.id ? [a, b] : [b, a];
}

function sortPairs(pairs: DuplicateReviewPair[]) {
  return pairs.sort((left, right) => {
    const leftTime = Math.max(left.activityA.occurredAt.getTime(), left.activityB.occurredAt.getTime());
    const rightTime = Math.max(right.activityA.occurredAt.getTime(), right.activityB.occurredAt.getTime());
    return rightTime - leftTime;
  });
}

export async function getDuplicateReviewCentreData(): Promise<DuplicateReviewCentreData> {
  const [activitiesResult, decisions] = await Promise.all([
    prisma.activity.findMany({
      select: {
        id: true,
        userId: true,
        columnId: true,
        category: true,
        distance: true,
        pace: true,
        duration: true,
        elevationGain: true,
        points: true,
        completedWithFriend: true,
        companion: true,
        proofUrl: true,
        stravaActivityId: true,
        status: true,
        rejectionReason: true,
        occurredAt: true,
        createdAt: true,
        reviewedAt: true,
        user: { select: { id: true, name: true } },
        column: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: 'desc' },
    }),
    prisma.$queryRawUnsafe(`
      SELECT pair_key AS "pairKey", activity_a_id AS "activityAId", activity_b_id AS "activityBId",
        status, duplicate_activity_id AS "duplicateActivityId", kept_activity_id AS "keptActivityId",
        note, reviewed_by_id AS "reviewedById", reviewed_by_name AS "reviewedByName",
        reviewed_at AS "reviewedAt", updated_at AS "updatedAt"
      FROM app_internal.duplicate_review_decision
      ORDER BY updated_at DESC
    `) as Promise<DuplicateReviewDecision[]>,
  ]);

  const activities = activitiesResult as DuplicateReviewActivity[];
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const decisionByKey = new Map(decisions.map((decision) => [decision.pairKey, decision]));
  const generated = new Map<string, DuplicateReviewPair>();
  const active = activities.filter((activity) => activity.status !== 'REJECTED');

  for (let leftIndex = 0; leftIndex < active.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex++) {
      const first = active[leftIndex];
      const second = active[rightIndex];
      if (first.userId !== second.userId) continue;
      const reason = duplicateReason(first, second);
      if (!reason) continue;
      const [activityA, activityB] = orderedPair(first, second);
      const pairKey = duplicatePairKey(activityA.id, activityB.id);
      generated.set(pairKey, {
        pairKey,
        reason,
        activityA,
        activityB,
        decision: decisionByKey.get(pairKey) ?? null,
      });
    }
  }

  const open: DuplicateReviewPair[] = [];
  const later: DuplicateReviewPair[] = [];
  const resolved: DuplicateReviewPair[] = [];

  for (const pair of generated.values()) {
    if (!pair.decision) open.push(pair);
    else if (pair.decision.status === 'LATER') later.push(pair);
    else resolved.push(pair);
  }

  for (const decision of decisions) {
    if (decision.status === 'LATER' || generated.has(decision.pairKey)) continue;
    const first = activityById.get(decision.activityAId);
    const second = activityById.get(decision.activityBId);
    if (!first || !second) continue;
    const reason = duplicateReason({ ...first, status: 'PENDING' }, { ...second, status: 'PENDING' }) ?? 'Previously reviewed duplicate candidate';
    resolved.push({
      pairKey: decision.pairKey,
      reason,
      activityA: first,
      activityB: second,
      decision,
    });
  }

  return { open: sortPairs(open), later: sortPairs(later), resolved: sortPairs(resolved) };
}

async function getReviewer(tx: Prisma.TransactionClient, reviewerId: string) {
  const reviewer = await tx.user.findUnique({ where: { id: reviewerId }, select: { name: true } });
  if (!reviewer) throw new DuplicateReviewError('Reviewer account was not found.', 403);
  return reviewer;
}

async function loadLockedPair(tx: Prisma.TransactionClient, activityAId: string, activityBId: string) {
  if (!activityAId || !activityBId || activityAId === activityBId) throw new DuplicateReviewError('Choose two different activities.');
  const [firstId, secondId] = [activityAId, activityBId].sort();
  const rows = await tx.$queryRawUnsafe<import('@prisma/client').Activity[]>(
    'SELECT * FROM "Activity" WHERE id IN ($1,$2) ORDER BY id FOR UPDATE',
    firstId,
    secondId,
  );
  if (rows.length !== 2) throw new DuplicateReviewError('One of the activities no longer exists.', 404);
  const reason = duplicateReason(rows[0], rows[1]);
  if (!reason) throw new DuplicateReviewError('These activities no longer match the duplicate rules. Refresh the review centre.', 409);
  return { firstId, secondId, first: rows[0], second: rows[1], reason };
}

async function writeDecision(
  tx: Prisma.TransactionClient,
  input: {
    firstId: string;
    secondId: string;
    status: DuplicateDecisionStatus;
    reviewerId: string;
    reviewerName: string;
    note: string | null;
    duplicateActivityId?: string | null;
    keptActivityId?: string | null;
  },
) {
  const pairKey = duplicatePairKey(input.firstId, input.secondId);
  await tx.$executeRawUnsafe(
    `INSERT INTO app_internal.duplicate_review_decision
      (pair_key, activity_a_id, activity_b_id, status, duplicate_activity_id, kept_activity_id, note, reviewed_by_id, reviewed_by_name, reviewed_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT (pair_key) DO UPDATE SET
       status=EXCLUDED.status,
       duplicate_activity_id=EXCLUDED.duplicate_activity_id,
       kept_activity_id=EXCLUDED.kept_activity_id,
       note=EXCLUDED.note,
       reviewed_by_id=EXCLUDED.reviewed_by_id,
       reviewed_by_name=EXCLUDED.reviewed_by_name,
       reviewed_at=CURRENT_TIMESTAMP,
       updated_at=CURRENT_TIMESTAMP`,
    pairKey,
    input.firstId,
    input.secondId,
    input.status,
    input.duplicateActivityId ?? null,
    input.keptActivityId ?? null,
    input.note,
    input.reviewerId,
    input.reviewerName,
  );
  return pairKey;
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  reviewerId: string,
  reviewerName: string,
  action: string,
  pairKey: string,
  details: Record<string, unknown>,
) {
  await tx.$executeRawUnsafe(
    'INSERT INTO "AdminAudit" ("id", "actorId", "actorName", "action", "target", "details") VALUES ($1,$2,$3,$4,$5,$6::jsonb)',
    randomUUID(),
    reviewerId,
    reviewerName,
    action,
    pairKey,
    JSON.stringify(details),
  );
}

export async function saveDuplicateReviewDecision(input: {
  activityAId: string;
  activityBId: string;
  status: 'DIFFERENT' | 'LATER';
  reviewerId: string;
  note?: string;
}) {
  const note = input.note?.trim().slice(0, 500) || null;
  if (input.status === 'DIFFERENT' && (!note || note.length < 5)) {
    throw new DuplicateReviewError('Add a short note explaining why these are different workouts (at least 5 characters).');
  }

  return prisma.$transaction(async (tx) => {
    const pair = await loadLockedPair(tx, input.activityAId, input.activityBId);
    const reviewer = await getReviewer(tx, input.reviewerId);
    const pairKey = await writeDecision(tx, {
      firstId: pair.firstId,
      secondId: pair.secondId,
      status: input.status,
      reviewerId: input.reviewerId,
      reviewerName: reviewer.name,
      note,
    });
    await writeAudit(
      tx,
      input.reviewerId,
      reviewer.name,
      input.status === 'DIFFERENT' ? 'Duplicate review: different workouts' : 'Duplicate review: later',
      pairKey,
      { reason: pair.reason, note },
    );
    return { pairKey, status: input.status };
  }, { isolationLevel: 'Serializable' });
}

export async function markActivityAsDuplicate(input: {
  activityAId: string;
  activityBId: string;
  duplicateActivityId: string;
  reviewerId: string;
  note?: string;
}) {
  const note = input.note?.trim().slice(0, 500) || null;

  return prisma.$transaction(async (tx) => {
    const pair = await loadLockedPair(tx, input.activityAId, input.activityBId);
    if (![pair.firstId, pair.secondId].includes(input.duplicateActivityId)) {
      throw new DuplicateReviewError('Choose which of the two entries is the duplicate.');
    }
    const duplicate = pair.first.id === input.duplicateActivityId ? pair.first : pair.second;
    const kept = duplicate.id === pair.first.id ? pair.second : pair.first;
    const reviewer = await getReviewer(tx, input.reviewerId);

    if (duplicate.status === 'APPROVED') {
      const field = categoryScoreField[duplicate.category];
      const scoreUpdate = {
        totalPoints: { decrement: duplicate.points },
        [field]: { decrement: duplicate.points },
      } as Prisma.WeeklyScoreUpdateInput;
      await tx.weeklyScore.update({
        where: { userId_weekStart: { userId: duplicate.userId, weekStart: duplicate.weekStart } },
        data: scoreUpdate,
      });
    }

    const rejectionReason = `Duplicate of activity ${kept.id}${note ? ` — ${note}` : ''}`.slice(0, 300);
    const updated = await tx.activity.update({
      where: { id: duplicate.id },
      data: {
        status: 'REJECTED',
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
        rejectionReason,
      },
    });

    const pairKey = await writeDecision(tx, {
      firstId: pair.firstId,
      secondId: pair.secondId,
      status: 'DUPLICATE',
      duplicateActivityId: duplicate.id,
      keptActivityId: kept.id,
      reviewerId: input.reviewerId,
      reviewerName: reviewer.name,
      note,
    });
    await writeAudit(tx, input.reviewerId, reviewer.name, 'Duplicate review: marked duplicate', pairKey, {
      reason: pair.reason,
      duplicateActivityId: duplicate.id,
      keptActivityId: kept.id,
      reversedPoints: duplicate.status === 'APPROVED' ? duplicate.points : 0,
      note,
    });

    return { pairKey, duplicateActivityId: duplicate.id, keptActivityId: kept.id, activity: updated };
  }, { isolationLevel: 'Serializable' });
}

export async function refreshDuplicateReviewHealth() {
  await prisma.$queryRawUnsafe('SELECT app_internal.run_integrity_check()');
}
