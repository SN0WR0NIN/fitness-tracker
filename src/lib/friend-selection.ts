// Shared, browser-safe selection helpers. Legacy single-friend records/drafts
// remain readable without changing their points or modification timestamps.
export const MAX_ACTIVITY_FRIENDS = 100;
export type FriendSelection = { companionUserIds?: string[]; companionUserId?: string | null };
export function activityFriendIds(value: FriendSelection): string[] {
  const ids = value.companionUserIds?.length ? value.companionUserIds : value.companionUserId ? [value.companionUserId] : [];
  return [...new Set(ids)];
}
export function sameFriendSelection(a: FriendSelection, b: FriendSelection): boolean {
  const left = [...new Set(a.companionUserIds ?? (a.companionUserId ? [a.companionUserId] : []))].sort();
  const right = [...new Set(b.companionUserIds ?? (b.companionUserId ? [b.companionUserId] : []))].sort();
  return JSON.stringify(left) === JSON.stringify(right);
}
