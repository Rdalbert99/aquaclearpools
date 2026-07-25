import { supabase } from '@/integrations/supabase/client';

/**
 * Extract the object path inside a bucket from a stored Supabase Storage URL.
 * Handles both public (`/storage/v1/object/public/<bucket>/<path>`) and
 * signed (`/storage/v1/object/sign/<bucket>/<path>?token=...`) URLs, as well as
 * values that are already plain object paths.
 */
export function getStorageObjectPath(url: string, bucket: string): string | null {
  if (!url) return null;

  // Already a bare object path
  if (!/^https?:\/\//i.test(url)) {
    return url.replace(new RegExp(`^${bucket}/`), '');
  }

  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;

    // remainder looks like: public/<bucket>/<path> | sign/<bucket>/<path> | <bucket>/<path>
    let remainder = parsed.pathname.slice(idx + marker.length);
    remainder = remainder.replace(/^(public|sign|authenticated)\//, '');
    if (!remainder.startsWith(`${bucket}/`)) return null;

    return decodeURIComponent(remainder.slice(bucket.length + 1));
  } catch {
    return null;
  }
}

/**
 * Resolve a viewable URL for an object in a private bucket by creating a
 * short-lived signed URL. Falls back to the original value if signing fails.
 */
export async function getSignedStorageUrl(
  url: string | null | undefined,
  bucket: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!url) return null;

  const path = getStorageObjectPath(url, bucket);
  if (!path) return url;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error('Failed to create signed URL:', error);
    return null;
  }

  return data.signedUrl;
}
