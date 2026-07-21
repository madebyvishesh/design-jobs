import type { Job, AtsSource } from '@/types/job';
import { fetchYCJobs } from './fetchers/yc';
import { fetchAllAshbyJobs } from './fetchers/ashby';
import { fetchAllGreenhouseJobs } from './fetchers/greenhouse';
import { fetchAllLeverJobs } from './fetchers/lever';
import { fetchRemotiveJobs } from './fetchers/remotive';
import { fetchAllWorkdayJobs } from './fetchers/workday';
import { isDesignRole } from './filterJobs';

function deduplicateAndMergeSources(jobs: Job[]): Job[] {
  const byKey = new Map<string, Job>();

  for (const job of jobs) {
    // Normalise company name slightly for better matching
    const key = `${job.company.toLowerCase().replace(/[^a-z0-9]/g, '')}|${job.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, { ...job });
    } else {
      // Merge sources — keep union of all sources
      const mergedSources = Array.from(new Set([...existing.sources, ...job.sources])) as AtsSource[];

      // For the Apply URL: prefer a direct ATS link (Ashby/GH/Lever) over YC's workatastartup.com
      const ycEntry = existing.ats === 'yc' ? existing : (job.ats === 'yc' ? job : null);
      const directEntry = existing.ats !== 'yc' ? existing : (job.ats !== 'yc' ? job : null);
      // directEntry provides the actual job board URL; ycEntry provides batch badge and logo
      const urlSource = directEntry ?? ycEntry ?? existing;

      byKey.set(key, {
        ...urlSource,
        sources: mergedSources,
        // Direct ATS takes priority for ats badge; YC is a label source only when combined
        ats: mergedSources.includes('ashby') ? 'ashby'
          : mergedSources.includes('greenhouse') ? 'greenhouse'
          : mergedSources.includes('lever') ? 'lever'
          : mergedSources.includes('workday') ? 'workday'
          : mergedSources.includes('yc') ? 'yc'
          : 'remotive',
        // Pull batch badge and logo from YC entry since it has richer company metadata
        batch: ycEntry?.batch ?? urlSource.batch,
        logoUrl: ycEntry?.logoUrl ?? urlSource.logoUrl,
        // Use earlier of the two dates
        postedAt: urlSource.postedAt < existing.postedAt ? urlSource.postedAt : existing.postedAt,
      });
    }
  }

  return Array.from(byKey.values());
}

export async function fetchAllDesignJobs(): Promise<{
  aiJobs: Job[];
  allJobs: Job[];
}> {
  const [ycResult, ashbyResult, ghResult, leverResult, remotiveResult, workdayResult] = await Promise.allSettled([
    fetchYCJobs(),
    fetchAllAshbyJobs(),
    fetchAllGreenhouseJobs(),
    fetchAllLeverJobs(),
    fetchRemotiveJobs(),
    fetchAllWorkdayJobs(),
  ]);

  const allRaw: Job[] = [
    ...(ycResult.status === 'fulfilled' ? ycResult.value : []),
    ...(ashbyResult.status === 'fulfilled' ? ashbyResult.value : []),
    ...(ghResult.status === 'fulfilled' ? ghResult.value : []),
    ...(leverResult.status === 'fulfilled' ? leverResult.value : []),
    ...(remotiveResult.status === 'fulfilled' ? remotiveResult.value : []),
    ...(workdayResult.status === 'fulfilled' ? workdayResult.value : []),
  ].filter(job => isDesignRole(job.title));

  const deduped = deduplicateAndMergeSources(allRaw);

  const sorted = deduped.sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );

  return {
    aiJobs: sorted.filter(j => j.isAI),
    allJobs: sorted.filter(j => !j.isAI),
  };
}
