import { listingKnownSince, sixMonthCutoff } from './listingAge';
import { isDesignRole } from './filterJobs';
import { normalizeListing } from './listingText';
import { postingUrl } from './mergePostings';
import type { JobsPayload } from './jobsCache';

export function withFirstSeen(next: JobsPayload, previous: JobsPayload | null): JobsPayload {
  const history = { ...previous?.firstSeen };
  const ageEvidence = { ...previous?.ageEvidence };
  const cutoff = sixMonthCutoff(next.fetchedAt);
  let expiredCount = 0;

  function remember(job: JobsPayload['allJobs'][number], observedAt: number) {
    const firstSeenAt = Math.min(history[job.id] ?? observedAt, job.firstSeenAt ?? observedAt, observedAt);
    history[job.id] = firstSeenAt;
    const knownSince = Math.min(listingKnownSince(job, firstSeenAt), ageEvidence[job.id] ?? firstSeenAt);
    if (knownSince < firstSeenAt) ageEvidence[job.id] = knownSince;
    return { ...job, knownSince, firstSeenAt };
  }
  const priorByUrl = new Map<string, ReturnType<typeof remember>>();
  if (previous) {
    for (const job of [...previous.aiJobs, ...previous.allJobs]) {
      priorByUrl.set(postingUrl(job), remember(job, previous.fetchedAt));
    }
  }
  function stamp(jobs: JobsPayload['allJobs']) {
    return jobs.map(job => {
      const prior = priorByUrl.get(postingUrl(job));
      if (prior && prior.id !== job.id && prior.ats !== job.ats) {
        return remember({ ...job, firstSeenAt: prior.firstSeenAt,
          knownSince: Math.min(prior.knownSince, listingKnownSince(job, next.fetchedAt)) }, next.fetchedAt);
      }
      return remember(job, next.fetchedAt);
    });
  }
  const aiJobs = stamp(next.aiJobs);
  const allJobs = stamp(next.allJobs);
  const failed = next.report?.filter(board => board.status === 'unavailable' || board.status === 'partial') ?? [];
  if (previous && failed.length) {
    const seen = new Set([...aiJobs, ...allJobs].map(job => job.id));
    const currentUrls = new Set([...aiJobs, ...allJobs].map(postingUrl));
    const byBoard = new Map(failed.map(b => [b.source + ':' + b.board, b]));
    const domains = new Set(failed.map(b => b.source + ':' + b.domain));
    for (const job of [...previous.aiJobs, ...previous.allJobs]) {
      if (seen.has(job.id) || currentUrls.has(postingUrl(job))) continue;
      const board = job.boardKey ? byBoard.get(job.boardKey) : undefined;
      if (job.boardKey ? !board : !domains.has(job.ats + ':' + job.companyDomain)) continue;
      if (board?.unverifiedUrls && !board.unverifiedUrls.includes(job.url)) continue;
      const previousJob = normalizeListing(job);
      if (!isDesignRole(previousJob.title, previousJob.department, previousJob.companyDomain)) continue;
      (job.isAI ? aiJobs : allJobs).push({ ...remember(previousJob, previous.fetchedAt), lastVerifiedAt: job.lastVerifiedAt ?? previous.fetchedAt });
      seen.add(job.id);
    }
  }
  function withinWindow(job: JobsPayload['allJobs'][number]) {
    if (job.validThrough && Date.parse(job.validThrough) < next.fetchedAt) return false;
    const eligible = listingKnownSince(job, history[job.id]) >= cutoff;
    if (!eligible) expiredCount++;
    return eligible;
  }
  const eligibleAI = aiJobs.filter(withinWindow);
  const eligibleOthers = allJobs.filter(withinWindow);
  return { ...next, aiJobs: eligibleAI, allJobs: eligibleOthers, firstSeen: history, ageEvidence, expiredCount };
}
