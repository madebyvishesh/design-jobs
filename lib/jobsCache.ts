import type { Job } from '@/types/job';

export interface JobsPayload {
  aiJobs: Job[];
  allJobs: Job[];
  fetchedAt: number;
}

const BLOB_FILENAME = 'design-jobs-cache.json';

function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function getCachedJobs(): Promise<JobsPayload | null> {
  if (!isBlobConfigured()) return null;
  try {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: 'design-jobs-cache', limit: 1 });
    if (!blobs[0]) return null;
    // Fetch from Vercel's public CDN (fast, globally cached)
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json() as JobsPayload;
  } catch {
    return null;
  }
}

export async function setCachedJobs(payload: JobsPayload): Promise<void> {
  if (!isBlobConfigured()) return;
  try {
    const { put } = await import('@vercel/blob');
    await put(BLOB_FILENAME, JSON.stringify(payload), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
  } catch {
    // Silently skip — don't crash the page if Blob isn't linked yet
  }
}
