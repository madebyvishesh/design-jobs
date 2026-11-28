import type { Job } from '@/types/job';

import { hasCompletedJobBoard, type BoardReport } from './boardFetch';
import { withFirstSeen } from './firstSeen';

export interface JobsPayload {
  report?: BoardReport[];
  firstSeen?: Record<string, number>;
  ageEvidence?: Record<string, number>;
  expiredCount?: number;
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
  const signal = AbortSignal.timeout(8000);
  try {
    let response: Response;
    if (publicUrl) {
      const url = new URL(publicUrl);
      // Readers in the same minute share an edge cache entry after a snapshot overwrite.
      url.searchParams.set('publicationMinute', String(Math.floor(Date.now() / 60000)));
      response = await fetch(url, { cache: 'no-store', signal });
      if (!response.ok) return null;
    } else {
      const { head } = await import('@vercel/blob');
      const blob = await head(BLOB_FILENAME, { abortSignal: signal });
      const url = new URL(blob.url);
      url.searchParams.set('version', blob.etag);
      response = await fetch(url, { cache: 'no-store', signal });
      if (!response.ok) return null;
    }
    const snapshot: JobsPayload = await response.json();
    return Array.isArray(snapshot?.aiJobs) && Array.isArray(snapshot.allJobs) &&
      (snapshot.aiJobs.length + snapshot.allJobs.length > 0 || hasCompletedJobBoard(snapshot.report)) && Number.isFinite(snapshot.fetchedAt)
      ? snapshot : null;
  } catch {
    return null;
  }
}

// Writers require a versioned, readable baseline. A read outage must never look like an empty board.
export async function readPublisherSnapshot() {
  const { head, BlobNotFoundError } = await import('@vercel/blob');
  const version = await head(BLOB_FILENAME, { abortSignal: AbortSignal.timeout(10000) }).catch(error => {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  });
  if (!version) return null;
  if (!version.etag) throw new Error('Previous publication has no version');
  const url = new URL(version.url);
  url.searchParams.set('version', version.etag);
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Could not read previous publication (HTTP ' + response.status + ')');
  // The CDN weakens ETags on compressed representations of the same blob.
  const comparable = (etag: string) => etag.replace(/^W\//, '').replace(/^"|"$/g, '');
  const etag = response.headers.get('etag');
  if (etag && comparable(etag) !== comparable(version.etag)) throw new Error('Previous publication changed during read');
  const snapshot = await response.json() as JobsPayload;
  const validHistory = (value: unknown) => value === undefined || (value !== null && typeof value === 'object' &&
    !Array.isArray(value) && Object.values(value).every(time => Number.isFinite(time) && time > 0));
  if (!Array.isArray(snapshot?.allJobs) || !Array.isArray(snapshot.aiJobs) || !Number.isFinite(snapshot.fetchedAt) ||
      !validHistory(snapshot.firstSeen) || !validHistory(snapshot.ageEvidence)) {
    throw new Error('Invalid previous publication');
  }
  return { etag: version.etag, snapshot };
}

export async function setCachedJobs(payload: JobsPayload, baseline: Awaited<ReturnType<typeof readPublisherSnapshot>>): Promise<JobsPayload> {
  const { put, BlobPreconditionFailedError } = await import('@vercel/blob');
  if (!hasCompletedJobBoard(payload.report)) throw new Error('No board completed this refresh');
  if (baseline && baseline.snapshot.fetchedAt > payload.fetchedAt) return baseline.snapshot;
  const snapshot = withFirstSeen(payload, baseline?.snapshot ?? null);
  try {
    await put(BLOB_FILENAME, JSON.stringify(snapshot), {
      access: 'public', addRandomSuffix: false, allowOverwrite: Boolean(baseline),
      ifMatch: baseline?.etag, cacheControlMaxAge: 60, contentType: 'application/json',
    });
    return snapshot;
  } catch (error) {
    if (!(error instanceof BlobPreconditionFailedError)) throw error;
    const winner = await readPublisherSnapshot();
    if (!winner) throw error;
    console.log('Another refresh published first. Keeping its complete snapshot.');
    return winner.snapshot;
  }
}
