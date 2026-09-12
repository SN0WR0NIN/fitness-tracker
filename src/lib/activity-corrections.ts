import { assertAttachableProof, normalizeProofUrls } from '@/lib/proof-access';
import { resolveActivityFriends } from '@/lib/activity-friends';
import { activityFriendIds, sameFriendSelection } from '@/lib/friend-selection';
import { reconcileParticipantScores } from '@/lib/scoring-ledger';
import { planDailyActivityScores } from '@/lib/daily-friend-bonus';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Activity, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DEFAULT_SCORING_RULES, resolveEffectiveCategory, getWeekStart, getWeekNumber } from '@/lib/scoring';
import type { ChallengeSettings } from '@/lib/admin-control';
import { duplicateReason } from '@/lib/activity-duplicates';
import { isWithinChallengeWindow, parseActivityDate, singaporeDate } from '@/lib/activity-date';
import { FeatureError, assertCompetitionWritable } from '@/lib/operating-mode';

const proofSchema = z.string().url().max(2048).refine((url) => ['https:','http:'].includes(new URL(url).protocol), 'Use an HTTP or HTTPS proof link.').nullable();
export const CorrectionValuesSchema = z.object({
  activityDate: z.string().refine((date) => Boolean(parseActivityDate(date)), 'Choose a valid Singapore date, today or earlier.'),
  category: z.enum(['RUN','CYCLE','SWIM','WALK_OR_HIKE','TROOP_GAMES']),
  distance: z.number().min(0).max(100000),
  pace: z.number().positive().max(60).nullable(),
  duration: z.number().int().positive().max(100000).nullable(),
  companionUserId: z.string().min(1).nullable(),
  companionUserIds: z.array(z.string().min(1).max(200)).max(100).optional(),
  proofUrl: proofSchema,
}).strict().refine((value) => value.category === 'TROOP_GAMES' || value.distance > 0, 'Distance must be greater than zero.');
export const CreateCorrectionSchema = z.object({ activityId: z.string().min(1), reason: z.string().trim().min(5).max(1000), proposed: CorrectionValuesSchema }).strict();
export const DecideCorrectionSchema = z.object({ id: z.string().uuid(), decision: z.enum(['APPROVED','REJECTED']), reason: z.string().trim().min(5).max(1000), duplicateOverrideReason: z.string().trim().min(10).max(1000).optional() }).strict();
export type CorrectionValues = z.infer<typeof CorrectionValuesSchema>;
export type CorrectionSnapshot = CorrectionValues & { version: string; points: number; weekNumber: number; occurredAt: string; companionName: string | null };
export type CorrectionRecord = {
  id: string; activityId: string; userId: string; participantName: string; status: string; reason: string;
  original: CorrectionSnapshot; proposed: CorrectionSnapshot; applied: CorrectionSnapshot | null;
  decisionReason: string | null; createdAt: Date; reviewedAt: Date | null;
};

export function correctionSnapshot(activity: Activity): CorrectionSnapshot {
  return { activityDate: singaporeDate(activity.occurredAt), category: activity.category, distance: activity.distance,
    pace: activity.pace, duration: activity.duration, companionUserId: activity.companionUserId, companionUserIds: activityFriendIds(activity), proofUrl: activity.proofUrl,
    version: activity.updatedAt.toISOString(), points: activity.points, weekNumber: activity.weekNumber,
    occurredAt: activity.occurredAt.toISOString(), companionName: activity.companion };
}

async function settingsInTransaction(tx: Prisma.TransactionClient): Promise<ChallengeSettings> {
  const rows = await tx.$queryRaw<ChallengeSettings[]>`SELECT * FROM "ChallengeSetting" WHERE id='primary' FOR SHARE`;
  if (!rows[0]) throw new FeatureError('Challenge settings unavailable.', 503);
  return { ...rows[0], scoringRules: { ...DEFAULT_SCORING_RULES, ...rows[0].scoringRules } };
}

function proofGalleryForCorrection(activity: Activity, proposedPrimary: string | null): string[] {
  const current = normalizeProofUrls(activity.proofUrls, activity.proofUrl);
  if (proposedPrimary === activity.proofUrl) return current;
  const secondary = current.filter(value => value !== activity.proofUrl && value !== proposedPrimary);
  return proposedPrimary ? normalizeProofUrls([proposedPrimary, ...secondary]).slice(0, 5) : secondary.slice(0, 5);
}

async function prepareChange(tx: Prisma.TransactionClient, activity: Activity, proposed: CorrectionValues, settings: ChallengeSettings) {
  const occurredAt = proposed.activityDate === singaporeDate(activity.occurredAt) ? activity.occurredAt : parseActivityDate(proposed.activityDate)!;
  if (!isWithinChallengeWindow(occurredAt, settings.startDate, settings.endDate)) throw new FeatureError('The corrected date must be inside the challenge period.');
  const friends = await resolveActivityFriends(tx, activity.userId, proposed);
  let companion = friends.companion;
  if (!friends.companionUserIds.length && !activity.companionUserId && activity.companion && activity.completedWithFriend) {
    // Retain the existing admin-verified manual companion, as before. Members
    // cannot manufacture a manual bonus by supplying a free-text name.
    companion = activity.companion;
  }
  const category = resolveEffectiveCategory(proposed.category, proposed.pace ?? undefined, settings.scoringRules);
  const distance = category === 'TROOP_GAMES' ? 0 : proposed.distance;
  const proofUrls = proofGalleryForCorrection(activity, proposed.proofUrl);
  const proofUrl = proofUrls[0] ?? null;
  const siblings = await tx.activity.findMany({ where: { userId: activity.userId, id: { not: activity.id } } });
  const candidate = { ...activity, category, distance, pace: proposed.pace, occurredAt, proofUrl, proofUrls, completedWithFriend: Boolean(companion) };
  const scoring = planDailyActivityScores([...siblings, candidate], settings.scoringRules, settings.startDate).find(item => item.activity.id === activity.id)!.scoring;
  return { category, distance, pace: proposed.pace, duration: proposed.duration, occurredAt, weekStart: getWeekStart(occurredAt), weekNumber: getWeekNumber(occurredAt,settings.startDate), proofUrl, proofUrls, companionUserId: friends.companionUserId, companionUserIds: friends.companionUserIds, companion, completedWithFriend: Boolean(companion), points: scoring.totalPoints, scoring };
}

async function audit(tx: Prisma.TransactionClient, actorId: string, action: string, target: string, details: unknown) {
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { name: true } });
  await tx.$executeRaw`INSERT INTO "AdminAudit" (id,"actorId","actorName",action,target,details) VALUES (${randomUUID()},${actorId},${actor?.name ?? 'Participant'},${action},${target},${JSON.stringify(details)}::jsonb)`;
}

async function notify(tx: Prisma.TransactionClient, userId: string, id: string, status: string, message: string) {
  await tx.$executeRaw`INSERT INTO app_internal.notification(user_id,kind,level,title,message,href,metadata,dedupe_key)
    VALUES (${userId},'CORRECTION',${status === 'APPROVED' ? 'success' : 'info'},${status === 'APPROVED' ? 'Activity correction approved' : 'Activity correction update'},${message},'/corrections',${JSON.stringify({ correctionId:id, status })}::jsonb,${`correction:${id}:${status}`}) ON CONFLICT(dedupe_key) DO NOTHING`;
}

async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt=0; attempt<3; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel:'Serializable', timeout:15000 }); }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') { if (attempt<2) continue; throw new FeatureError('The activity changed while saving. Reload and try again.',409); }
      throw error;
    }
  }
  throw new FeatureError('Please retry the change.',409);
}

export async function createCorrection(userId: string, input: z.infer<typeof CreateCorrectionSchema>) {
  return serializable(async (tx) => {
    await assertCompetitionWritable(tx, true);
    const rows = await tx.$queryRaw<Activity[]>`SELECT * FROM "Activity" WHERE id=${input.activityId} AND "userId"=${userId} FOR UPDATE`;
    const activity = rows[0];
    if (!activity) throw new FeatureError('Activity not found.',404);
    if (activity.status !== 'APPROVED') throw new FeatureError('Only approved activities need a correction request. Pending activities can be edited directly.',409);
    const existing = await tx.$queryRaw<Array<{ id:string }>>`SELECT id::text FROM app_internal.activity_correction WHERE activity_id=${activity.id} AND status='OPEN'`;
    if (existing.length) throw new FeatureError('This activity already has an open correction request. Track or cancel it in My correction requests.',409);
    const original = correctionSnapshot(activity);
    const values = CorrectionValuesSchema.parse(input.proposed);
    await assertAttachableProof(tx, values.proofUrl, userId, activity.proofUrl);
    const unchanged = Object.entries(values).filter(([key]) => !['companionUserId','companionUserIds'].includes(key)).every(([key,value]) => original[key as keyof CorrectionSnapshot] === value) && sameFriendSelection(original, values);
    if (unchanged) throw new FeatureError('Change at least one activity field before sending a correction.');
    const change = await prepareChange(tx,activity,values,await settingsInTransaction(tx));
    const proposed = correctionSnapshot({ ...activity, ...change });
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO app_internal.activity_correction(id,activity_id,user_id,reason,original,proposed) VALUES (${id}::uuid,${activity.id},${userId},${input.reason},${JSON.stringify(original)}::jsonb,${JSON.stringify(proposed)}::jsonb)`;
    await audit(tx,userId,'CORRECTION_REQUESTED',activity.id,{ correctionId:id, reason:input.reason, original, proposed });
    return { id, status:'OPEN', message:'Correction requested. Your activity and points are unchanged until an admin approves it.' };
  });
}

export async function listCorrections(userId: string | null, history = false): Promise<CorrectionRecord[]> {
  return prisma.$queryRaw<CorrectionRecord[]>`SELECT c.id::text,c.activity_id AS "activityId",c.user_id AS "userId",u.name AS "participantName",c.status,c.reason,c.original,c.proposed,c.applied,c.decision_reason AS "decisionReason",c.created_at AS "createdAt",c.reviewed_at AS "reviewedAt"
    FROM app_internal.activity_correction c JOIN "User" u ON u.id=c.user_id
    WHERE (${userId}::text IS NULL OR c.user_id=${userId}) AND (${userId}::text IS NOT NULL OR (CASE WHEN ${history} THEN c.status<>'OPEN' ELSE c.status='OPEN' END))
    ORDER BY (c.status='OPEN') DESC,c.created_at DESC LIMIT 100`;
}

export async function cancelCorrection(userId: string, id: string) {
  return serializable(async (tx) => {
    await assertCompetitionWritable(tx,true);
    const rows = await tx.$queryRaw<Array<{activity_id:string}>>`UPDATE app_internal.activity_correction SET status='CANCELLED',updated_at=now(),decision_reason='Cancelled by participant' WHERE id=${id}::uuid AND user_id=${userId} AND status='OPEN' RETURNING activity_id`;
    if (!rows[0]) throw new FeatureError('Open correction request not found.',409);
    await audit(tx,userId,'CORRECTION_CANCELLED',rows[0].activity_id,{correctionId:id});
    return {status:'CANCELLED'};
  });
}

export async function decideCorrection(adminId: string, input: z.infer<typeof DecideCorrectionSchema>) {
  return serializable(async (tx) => {
    await assertCompetitionWritable(tx);
    const requests = await tx.$queryRaw<Array<{id:string;activity_id:string;user_id:string;status:string;original:CorrectionSnapshot;proposed:CorrectionSnapshot}>>`SELECT * FROM app_internal.activity_correction WHERE id=${input.id}::uuid FOR UPDATE`;
    const request = requests[0];
    if (!request) throw new FeatureError('Correction request not found.',404);
    if (request.status !== 'OPEN') throw new FeatureError('This request has already been decided. Reload to see its status.',409);
    const rows = await tx.$queryRaw<Activity[]>`SELECT * FROM "Activity" WHERE id=${request.activity_id} FOR UPDATE`;
    const activity = rows[0];
    if (input.decision === 'APPROVED' && (!activity || activity.userId !== request.user_id || activity.status !== 'APPROVED' || activity.updatedAt.toISOString() !== request.original.version)) {
      await tx.$executeRaw`UPDATE app_internal.activity_correction SET status='STALE',decision_reason='The activity changed after this request. Submit a new request using the current activity.',reviewed_by_id=${adminId},reviewed_at=now(),updated_at=now() WHERE id=${input.id}::uuid`;
      await audit(tx,adminId,'CORRECTION_STALE',request.activity_id,{correctionId:input.id});
      await notify(tx,request.user_id,input.id,'STALE','Your activity changed after the correction was requested. Check its current details and submit a new request if needed.');
      return {status:'STALE', message:'The activity changed after the request. Nothing was overwritten. Ask the participant to submit a new request.'};
    }
    let applied: CorrectionSnapshot | null = null;
    let dirtyWeeks: number[] = [];
    if (input.decision === 'APPROVED' && activity) {
      const raw = request.proposed;
      const values = CorrectionValuesSchema.parse({activityDate:raw.activityDate,category:raw.category,distance:raw.distance,pace:raw.pace,duration:raw.duration,companionUserId:raw.companionUserId,companionUserIds:raw.companionUserIds,proofUrl:raw.proofUrl});
      await assertAttachableProof(tx, values.proofUrl, request.user_id, activity.proofUrl);
      const change = await prepareChange(tx,activity,values,await settingsInTransaction(tx));
      const candidates = await tx.activity.findMany({where:{userId:activity.userId,id:{not:activity.id},status:{not:'REJECTED'}}});
      const matches = candidates.flatMap((candidate) => {const reason=duplicateReason({...activity,...change},candidate);return reason?[{id:candidate.id,reason}]:[];});
      if (matches.length && !input.duplicateOverrideReason) throw new FeatureError('Possible duplicate. Compare the matching activities before approving; an explicit override explanation is required.',409,{matches});
      const {scoring,...data} = change;
      const updated = await tx.activity.update({where:{id:activity.id},data:{...data,reviewedById:adminId,reviewedAt:new Date()}});
      await tx.pointsLog.updateMany({where:{activityId:activity.id},data:scoring});
      await reconcileParticipantScores(tx, activity.userId);
      applied=correctionSnapshot(await tx.activity.findUniqueOrThrow({where:{id:activity.id}}));
      const dirty = await tx.$queryRaw<Array<{week_number:number}>>`SELECT week_number FROM app_internal.weekly_result_dirty WHERE (season_key,week_number) IN (SELECT season_key,week_number FROM app_internal.weekly_result WHERE week_start_key IN (${activity.weekStart}::date,${updated.weekStart}::date))`;
      dirtyWeeks=dirty.map((row)=>row.week_number);
    }
    await tx.$executeRaw`UPDATE app_internal.activity_correction SET status=${input.decision},decision_reason=${input.reason},duplicate_override_reason=${input.duplicateOverrideReason ?? null},applied=${applied?JSON.stringify(applied):null}::jsonb,reviewed_by_id=${adminId},reviewed_at=now(),updated_at=now() WHERE id=${input.id}::uuid`;
    await audit(tx,adminId,`CORRECTION_${input.decision}`,request.activity_id,{correctionId:input.id,reason:input.reason,duplicateOverrideReason:input.duplicateOverrideReason ?? null,original:request.original,applied,dirtyWeeks});
    await notify(tx,request.user_id,input.id,input.decision,input.decision==='APPROVED'?`Your correction was approved. The activity now earns ${applied?.points.toFixed(1)} points. ${input.reason}`:`Your correction was not approved. ${input.reason}`);
    return {status:input.decision,applied,dirtyWeeks};
  });
}
