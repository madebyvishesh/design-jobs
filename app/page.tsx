import { Suspense, cache } from 'react';
import { waitUntil } from '@vercel/functions';
import { unstable_cache } from 'next/cache';
import { fetchAllDesignJobs } from '@/lib/fetchAllJobs';
import { getCachedJobs } from '@/lib/jobsCache';
import RefreshListings from '@/components/RefreshListings';
import JobTable from '@/components/JobTable';
import { readBrowseParams, type BrowseCriteria } from '@/lib/browseParams';
import { classifyDate } from '@/lib/jobDates';
import { isDesignRole } from '@/lib/filterJobs';
import BoardHeader from '@/components/BoardHeader';

export const revalidate = 0;
export const maxDuration = 60;

const refreshInterval = 30 * 60 * 1000;

async function fetchSnapshot() {
  const jobs = await fetchAllDesignJobs();
  if (!jobs.aiJobs.length && !jobs.allJobs.length) {
    throw new Error('No listings returned by job sources');
  }
  return { ...jobs, fetchedAt: Date.now() };
}

// Failed revalidation keeps the last successful publication available during a storage outage.
const getPublished = unstable_cache(async () => {
  const snapshot = await getCachedJobs();
  if (!snapshot) throw new Error('Published job snapshot unavailable');
  return snapshot;
}, ['listings-published-v1'], { revalidate: 60 });

const getFallback = unstable_cache(fetchSnapshot, ['listings-fallback-v3'], { revalidate: 1800 });
let pendingFetch: ReturnType<typeof fetchSnapshot> | undefined;

const getListings = cache(async () => {
  const published = await getPublished().catch(error => {
    console.error('Could not read published listings', error);
    return null;
  });
  if (published) return published;

  pendingFetch ??= getFallback().finally(() => { pendingFetch = undefined; });
  const refresh = pendingFetch.catch(error => {
    console.error('Listings refresh failed', error);
    return null;
  });
  waitUntil(refresh);
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      refresh,
      new Promise<null>(resolve => { deadline = setTimeout(() => resolve(null), 12000); }),
    ]);
  } finally {
    clearTimeout(deadline);
  }
});

async function JobsContent({ initial }: { initial: BrowseCriteria }) {
  const listings = await getListings();
  if (!listings) return (
    <>
      <BoardHeader />
      <main id="jobs" className="board-width board-empty" role="status">
        <h2>Listings are temporarily unavailable</h2>
        <p>Try again in a few minutes.</p>
        <a className="board-control" href="/">Retry</a>
        <RefreshListings fetchedAt={0} interval={refreshInterval} />
      </main>
    </>
  );
  const jobs = [...listings.aiJobs, ...listings.allJobs]
    .filter(job => isDesignRole(job.title, job.department))
    .map(job => ({ ...job, ...classifyDate(job) }));
  const checked = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    hour12: true, timeZone: 'Asia/Kolkata',
  }).format(listings.fetchedAt);

  return (
    <>
      <JobTable jobs={jobs} fetchedAt={listings.fetchedAt} checked={checked} initial={initial} />
      <RefreshListings fetchedAt={listings.fetchedAt} interval={refreshInterval} />
    </>
  );
}

export default function Home({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const initial = readBrowseParams({ get(key) {
    const value = searchParams[key];
    return (Array.isArray(value) ? value[0] : value) ?? null;
  } });
  return (
    <div className="board-shell">
      <Suspense fallback={<><BoardHeader /><main id="jobs" className="board-width board-loading" role="status">Loading listings…</main></>}>
        <JobsContent initial={initial} />
      </Suspense>
    </div>
  );
}
