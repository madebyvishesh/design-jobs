import type { JobsPayload } from './jobsCache';

export function withFirstSeen(next: JobsPayload, previous: JobsPayload | null): JobsPayload {
  const history = { ...previous?.firstSeen };
  if (previous) {
    for (const job of [...previous.aiJobs, ...previous.allJobs]) history[job.id] ??= job.firstSeenAt ?? previous.fetchedAt;
  }
  function stamp(jobs: JobsPayload['allJobs']) {
    return jobs.map(job => ({ ...job, firstSeenAt: history[job.id] ??= next.fetchedAt }));
  }
  const aiJobs = stamp(next.aiJobs);
  const allJobs = stamp(next.allJobs);
  const failed = next.report?.filter(board => board.status === 'unavailable') ?? [];
  if (previous && failed.length) {
    const seen = new Set([...aiJobs, ...allJobs].map(job => job.id));
    const keys = new Set(failed.map(b => b.source + ':' + b.board));
    const domains = new Set(failed.map(b => b.source + ':' + b.domain));
    for (const job of [...previous.aiJobs, ...previous.allJobs]) {
      if (seen.has(job.id)) continue;
      if (job.boardKey ? !keys.has(job.boardKey) : !domains.has(job.ats + ':' + job.companyDomain)) continue;
      (job.isAI ? aiJobs : allJobs).push({ ...job, firstSeenAt: history[job.id], lastVerifiedAt: job.lastVerifiedAt ?? previous.fetchedAt });
      seen.add(job.id);
    }
  }
  return { ...next, aiJobs, allJobs, firstSeen: history };
}
