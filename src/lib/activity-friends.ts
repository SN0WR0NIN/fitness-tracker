import type { Prisma } from '@prisma/client';
import { ActivityEditError } from '@/lib/activity-duplicates';
import { MAX_ACTIVITY_FRIENDS, type FriendSelection } from '@/lib/friend-selection';

/** Validate all identities in one query. One workout still receives only one
 * configured friend bonus; selecting friends never creates workouts for them. */
export async function resolveActivityFriends(db: Pick<Prisma.TransactionClient, 'user'>, ownerId: string, selection: FriendSelection) {
  const raw = selection.companionUserIds ?? (selection.companionUserId ? [selection.companionUserId] : []);
  if (!Array.isArray(raw) || raw.length > MAX_ACTIVITY_FRIENDS || raw.some((id) => typeof id !== 'string' || !id.trim() || id.length > 200)) {
    throw new ActivityEditError('Choose a valid list of registered friends.', 400);
  }
  const ids = [...new Set(raw)].sort();
  if (ids.includes(ownerId)) throw new ActivityEditError('You cannot select the activity owner as their own friend.', 400);
  if (selection.companionUserIds !== undefined && selection.companionUserId && !ids.includes(selection.companionUserId)) {
    throw new ActivityEditError('Conflicting friend selections. Refresh the form and select your friends again.', 400);
  }
  const people = ids.length ? await db.user.findMany({ where: { id: { in: ids }, role: 'MEMBER', columnId: { not: null } }, select: { id: true, name: true } }) : [];
  if (people.length !== ids.length) throw new ActivityEditError('One or more selected friends are unavailable. Choose registered participants assigned to a column.', 400);
  return {
    companionUserIds: ids,
    // Compatibility for existing reports and achievement counts: still one
    // companion-bearing activity, regardless of the size of the group.
    companionUserId: ids[0] ?? null,
    companion: people.length ? people.sort((a, b) => a.name.localeCompare(b.name)).map((person) => person.name).join(', ') : null,
    completedWithFriend: ids.length > 0,
  };
}
