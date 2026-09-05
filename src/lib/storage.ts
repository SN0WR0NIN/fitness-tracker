import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const PROOF_BUCKET = 'activity-proofs';
export const PROFILE_BUCKET = 'profile-photos';

let client: SupabaseClient | null = null;

/**
 * Lazily creates the Supabase admin client (service role key bypasses RLS for
 * server-side uploads). Deferred so a missing env var only fails requests
 * that actually need storage, not the whole app at build/import time.
 */
function getSupabaseAdmin(): SupabaseClient {
  if (client) {
    return client;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  return client;
}

/**
 * Ensures the proof-upload bucket exists (public read, so approved proof
 * images can be viewed directly via their URL).
 */
export async function ensureProofBucketExists(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw listError;
  }

  if (buckets?.some((bucket) => bucket.name === PROOF_BUCKET)) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(PROOF_BUCKET, {
    public: true,
    fileSizeLimit: '4MB',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  });
  if (createError) throw createError;
}

export async function uploadProofImage(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(fileName, buffer, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage.from(PROOF_BUCKET).getPublicUrl(data.path);
  return publicUrlData.publicUrl;
}

export async function ensureProfileBucketExists(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;
  if (buckets?.some((bucket) => bucket.name === PROFILE_BUCKET)) return;

  const { error: createError } = await supabase.storage.createBucket(PROFILE_BUCKET, {
    public: true,
    fileSizeLimit: '2MB',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  if (createError) throw createError;
}

export async function uploadProfileImage(buffer: Buffer, userId: string, contentType: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const path = `${userId}/avatar`;
  const { data, error } = await supabase.storage.from(PROFILE_BUCKET).upload(path, buffer, {
    contentType,
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  const { data: publicUrlData } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(data.path);
  return `${publicUrlData.publicUrl}?v=${Date.now()}`;
}

export async function deleteProfileImage(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(PROFILE_BUCKET).remove([`${userId}/avatar`]);
  if (error) throw error;
}

export function isProfileImageUrlForUser(value: string, userId: string): boolean {
  try {
    const url = new URL(value);
    const configuredUrl = process.env.SUPABASE_URL;
    if (!configuredUrl) return false;
    return url.protocol === 'https:'
      && url.hostname === new URL(configuredUrl).hostname
      && url.pathname.endsWith(`/storage/v1/object/public/${PROFILE_BUCKET}/${userId}/avatar`);
  } catch {
    return false;
  }
}
