/** This helper never signs URLs and is safe to use in client components. */
export function proofDisplayHref(reference: string | null | undefined, original = false): string | null {
  if (!reference) return null;
  return `/api/proofs?ref=${encodeURIComponent(reference)}${original ? '&original=1' : ''}`;
}

export type ProofReference = { kind: 'storage'; path: string } | { kind: 'external'; url: string; preview: string } | { kind: 'fixture'; path: string };

export function parseProofReference(value: string, storageUrl: string | undefined, localFixture = false): ProofReference | null {
  if (value.length > 2048 || /[\u0000-\u0020\\]/.test(value)) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null;
  // Reject encoded path separators/traversals BEFORE URL normalization.
  if (/(?:^|\/)(?:\.{1,2}|%2e(?:%2e)?)(?:\/|$)/i.test(value) || /%2f|%5c|%00/i.test(value)) return null;
  if (localFixture && url.hostname === 'example.invalid') {
    return { kind: 'fixture', path: url.pathname.replace(/^\/e2e-proof\//, '') };
  }
  let configured: URL | null = null;
  try { configured = storageUrl ? new URL(storageUrl) : null; } catch { /* fail closed */ }
  if (configured && url.origin === configured.origin) {
    const prefix = '/storage/v1/object/public/activity-proofs/';
    if (!url.pathname.startsWith(prefix) || url.search) return null;
    const path = url.pathname.slice(prefix.length);
    // Existing canonical keys are retained; encoded aliases are not new identities.
    if (!path || path.length > 512 || path.includes('%') || !path.split('/').every(p => /^[a-zA-Z0-9_.-]+$/.test(p) && p !== '.' && p !== '..')) return null;
    if (path.split('/').length < 2) return null;
    return { kind: 'storage', path };
  }
  // No arbitrary URL fetching, SSRF proxy, or signed-source URLs. Legacy sources
  // remain governed by their providers; only their disclosure is restricted here.
  if (url.hostname === 'drive.google.com') {
    const id = url.searchParams.get('id') || url.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1];
    if (!id || !/^[\w-]{5,200}$/.test(id)) return null;
    return { kind: 'external', url: url.href, preview: `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200` };
  }
  if (url.hostname === 'dgtzuqphqg23d.cloudfront.net' && !url.search) return { kind: 'external', url: url.href, preview: url.href };
  return null;
}
