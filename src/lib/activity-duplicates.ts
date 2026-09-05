export type DuplicateCandidate = { id?: string; userId: string; category: string; distance: number; occurredAt: Date | string; proofUrl?: string | null; status?: string };
export function proofKey(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.hostname === 'drive.google.com') {
      const id = url.searchParams.get('id') || url.pathname.match(/\/d\/([^/]+)/)?.[1];
      if (id) return `drive:${id}`;
    }
    // Signed storage links may have different tokens for the same object.
    if (url.pathname.includes('/storage/v1/object/')) return `${url.origin}${url.pathname.replace('/sign/', '/public/')}`;
    url.hash = ''; return url.toString();
  } catch { return value; }
}
const singaporeDay = (date: Date | string) => new Date(new Date(date).getTime() + 8 * 3600000).toISOString().slice(0, 10);
export function duplicateReason(a: DuplicateCandidate, b: DuplicateCandidate): string | null {
  if (a.id && a.id === b.id) return null;
  if (a.userId !== b.userId || b.status === 'REJECTED') return null;
  const proof = proofKey(a.proofUrl);
  if (proof && proof === proofKey(b.proofUrl)) return 'Same proof attachment';
  if (a.category !== b.category || a.distance <= 0 || b.distance <= 0) return null;
  if (Math.abs(a.distance - b.distance) <= Math.max(a.distance, b.distance) * 0.02 && singaporeDay(a.occurredAt) === singaporeDay(b.occurredAt)) return 'Similar distance on the same Singapore date';
  return null;
}
export class DuplicateApprovalError extends Error {
  constructor(public matches: { id: string; reason: string }[]) { super('Possible duplicate. Compare the matching submissions before approving.'); }
}
export class ActivityEditError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
