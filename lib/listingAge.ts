import type { Job } from '../types/job';
import type { JobsPayload } from './jobsCache';
import { classifyDate } from './jobDates';

// Use UTC calendar days, clamping to the last day of shorter months.
export function sixMonthCutoff(now: number) {
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() - 6;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay));
}

export function listingKnownSince(job: Job, observedAt: number) {
  const date = classifyDate(job);
  const evidence = [job.firstSeenAt, job.knownSince, job.lastVerifiedAt, Date.parse(date.postedAt)];
  return evidence.reduce<number>((earliest, time) =>
    typeof time === 'number' && Number.isFinite(time) && time > 0 ? Math.min(earliest, time) : earliest,
    observedAt);
}

export function expiredListingIds(snapshot: JobsPayload, cutoff: number) {
  const expired = new Set<string>();
  for (const [id, observed] of Object.entries(snapshot.firstSeen ?? {})) {
    if (Math.min(observed, snapshot.ageEvidence?.[id] ?? observed) < cutoff) expired.add(id);
  }
  for (const job of [...snapshot.aiJobs, ...snapshot.allJobs]) {
    if (listingKnownSince(job, snapshot.fetchedAt) < cutoff) expired.add(job.id);
  }
  return Array.from(expired);
}
