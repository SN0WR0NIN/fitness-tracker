import { redirect } from 'next/navigation';
import DuplicateReviewCentre from '@/components/DuplicateReviewCentre';
import { requireAdmin } from '@/lib/adminGuard';
import { getDuplicateReviewCentreData, type DuplicateReviewActivity, type DuplicateReviewPair } from '@/lib/duplicate-review';

export const dynamic = 'force-dynamic';

function serializeActivity(activity: DuplicateReviewActivity) {
  return {
    ...activity,
    occurredAt: activity.occurredAt.toISOString(),
    createdAt: activity.createdAt.toISOString(),
    reviewedAt: activity.reviewedAt?.toISOString() ?? null,
  };
}

function serializePair(pair: DuplicateReviewPair) {
  return {
    ...pair,
    activityA: serializeActivity(pair.activityA),
    activityB: serializeActivity(pair.activityB),
    decision: pair.decision ? {
      ...pair.decision,
      reviewedAt: pair.decision.reviewedAt.toISOString(),
      updatedAt: pair.decision.updatedAt.toISOString(),
    } : null,
  };
}

export default async function DuplicateReviewPage() {
  const guard = await requireAdmin();
  if (guard.status === 401) redirect('/auth/login');
  if (guard.error) redirect('/dashboard');

  const data = await getDuplicateReviewCentreData();
  return <DuplicateReviewCentre data={{
    open: data.open.map(serializePair),
    later: data.later.map(serializePair),
    resolved: data.resolved.map(serializePair),
  }} />;
}
