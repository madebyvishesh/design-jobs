import type { JobsPayload } from './jobsCache';

export function withFirstSeen(next: JobsPayload, previous: JobsPayload | null): JobsPayload {
  const history = { ...previous?.firstSeen };
  if (previous) {
    for (const job of [...previous.aiJobs, ...previous.allJobs]) history[job.id] ??= job.firstSeenAt ?? previous.fetchedAt;
  }
  function stamp(jobs: JobsPayload['allJobs']) {
    return jobs.map(job => ({ ...job, firstSeenAt: history[job.id] ??= next.fetchedAt }));
  }
  return { ...next, aiJobs: stamp(next.aiJobs), allJobs: stamp(next.allJobs), firstSeen: history };
}
