import { fetchYCJobs } from './fetchers/yc';
import { fetchAllAshbyJobs } from './fetchers/ashby';
import { fetchAllGreenhouseJobs } from './fetchers/greenhouse';
import { fetchAllLeverJobs } from './fetchers/lever';
import { fetchRemotiveJobs } from './fetchers/remotive';
import { fetchAllWorkdayJobs } from './fetchers/workday';
import { collectBoards, type BoardReport } from './boardFetch';
import { mergePostings } from './mergePostings';
import { isDesignRole } from './filterJobs';

export async function fetchAllDesignJobs() {
  const report: BoardReport[] = [];
  const groups = await Promise.all([
    collectBoards('yc', ['public'], board => ({ board, domain: '' }), fetchYCJobs, report),
    fetchAllAshbyJobs(report), fetchAllGreenhouseJobs(report), fetchAllLeverJobs(report),
    collectBoards('remotive', ['public'], board => ({ board, domain: '' }), fetchRemotiveJobs, report),
    fetchAllWorkdayJobs(report),
  ]);
  const sorted = mergePostings(groups.flat().filter(job => isDesignRole(job.title, job.department)))
    .sort((a,b) => b.postedAt.localeCompare(a.postedAt));
  return { aiJobs: sorted.filter(j => j.isAI), allJobs: sorted.filter(j => !j.isAI), report };
}
