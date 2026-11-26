import type { Job } from '@/types/job';

import { withFirstSeen } from './firstSeen';

export interface JobsPayload {
  firstSeen?: Record<string, number>;
  aiJobs: Job[];
  allJobs: Job[];
  fetchedAt: number;
}

const BLOB_FILENAME = 'design-jobs-cache.json';

function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function getCachedJobs(): Promise<JobsPayload | null> {
  // The scheduled publisher writes a public snapshot. Reading it needs no write token.
  const publicUrl = process.env.JOBS_SNAPSHOT_URL || (!isBlobConfigured()
    ? 'https://cwclyptedz0xvtaf.public.blob.vercel-storage.com/design-jobs-cache.json'
    : undefined);
  const signal = AbortSignal.timeout(4000);
  try {
    let response: Response;
    if (publicUrl) {
      response = await fetch(publicUrl, { cache: 'no-store', signal });
      if (!response.ok) return null;
    } else {
      const { get } = await import('@vercel/blob');
      const blob = await get(BLOB_FILENAME, { access: 'public', abortSignal: signal });
      if (!blob?.stream) return null;
      response = new Response(blob.stream);
    }
    const snapshot: JobsPayload = await response.json();
    return Array.isArray(snapshot?.aiJobs) && Array.isArray(snapshot.allJobs) &&
      snapshot.aiJobs.length + snapshot.allJobs.length > 0 && Number.isFinite(snapshot.fetchedAt)
      ? snapshot : null;
  } catch {
    return null;
  }
}

export async function setCachedJobs(payload: JobsPayload): Promise<void> {
  const { head, put, BlobNotFoundError, BlobPreconditionFailedError } = await import('@vercel/blob');
  for (let attempt = 1; ; attempt++) {
    try {
      const version = await head(BLOB_FILENAME).catch(error => {
        if (error instanceof BlobNotFoundError) return null;
        throw error;
      });
      let history: JobsPayload | null = null;
      if (version) {
        const url = new URL(version.url);
        url.searchParams.set('version', version.etag);
        const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Could not read the previous job snapshot (' + response.status + ')');
        history = await response.json() as JobsPayload;
        if (history.fetchedAt > payload.fetchedAt) return;
      }
      await put(BLOB_FILENAME, JSON.stringify(withFirstSeen(payload, history)), {
        access: 'public', addRandomSuffix: false, allowOverwrite: Boolean(version),
        ifMatch: version?.etag, cacheControlMaxAge: 60, contentType: 'application/json',
      });
      return;
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError) || attempt >= 3) throw error;
    }
  }
}
