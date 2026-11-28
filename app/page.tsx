import { Suspense, cache } from 'react';
import { waitUntil } from '@vercel/functions';
import { unstable_cache } from 'next/cache';
import { fetchAllDesignJobs } from '@/lib/fetchAllJobs';
import { getCachedJobs } from '@/lib/jobsCache';
import RefreshListings from '@/components/RefreshListings';
import JobTable from '@/components/JobTable';
import { readBrowseParams, type BrowseCriteria } from '@/lib/browseParams';
import { expiredListingIds, sixMonthCutoff } from '@/lib/listingAge';
import { classifyDate } from '@/lib/jobDates';
import { normalizeListing } from '@/lib/listingText';
import { isDesignRole } from '@/lib/filterJobs';
import { arrangements, arrangementOf, employmentOf, employmentTypes } from '@/lib/workFilters';
import BoardHeader from '@/components/BoardHeader';

export const revalidate = 0;
export const maxDuration = 60;

const refreshInterval = 30 * 60 * 1000;

async function fetchSnapshot() {
  const jobs = await fetchAllDesignJobs();
  if (!jobs.aiJobs.length && !jobs.allJobs.length) {
    throw new Error('No listings returned by job sources');
  }
  // Without publication history, an undated or updated-only record has no reliable age.
  const dated = (rows: typeof jobs.allJobs) => rows.filter(job => ['posted', 'created'].includes(classifyDate(job).dateKind));
  return { ...jobs, aiJobs: dated(jobs.aiJobs), allJobs: dated(jobs.allJobs), fetchedAt: Date.now() };
}

// Failed revalidation keeps the last successful publication available during a storage outage.
const getPublished = unstable_cache(async () => {
  const snapshot = await getCachedJobs();
  if (!snapshot) throw new Error('Published job snapshot unavailable');
  return snapshot;
}, ['listings-published-v2'], { revalidate: 60 });

const getFallback = unstable_cache(fetchSnapshot, ['listings-fallback-v4'], { revalidate: 1800 });
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

async function JobsContent({ initial, role }: { initial: BrowseCriteria; role:string }) {
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
  const cutoff = sixMonthCutoff(Date.now());
  const expired = new Set(expiredListingIds(listings, cutoff));
  const jobs = [...listings.aiJobs, ...listings.allJobs].map(normalizeListing)
    .filter(job => isDesignRole(job.title, job.department, job.companyDomain) && !expired.has(job.id))
    .map(job => ({ ...job, ...classifyDate(job) }));
  if (role) {
    const job=jobs.find(j=>j.id===role);
    return <><BoardHeader/><main id="jobs" className="board-width shared-role">
      <a href="/">Browse all roles</a>
      {job ? <article><h2>{job.title}</h2><p>{job.company}</p><dl>
        {[
          ['Location',job.location||'Not listed'],['Listed pay',job.salary||'Not listed'],
          ['Work arrangement',arrangements[arrangementOf(job)]],['Employment type',employmentOf(job).map(t=>employmentTypes[t]).join(' / ')],
          ['Department',job.department],['Listing date',job.postedAt && ((job.dateKind||'posted')+' '+job.postedAt.slice(0,10))]
        ].filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl><a className="primary-action" href={job.url} target="_blank" rel="noopener noreferrer">Apply at {job.company}</a></article>
      : <article><h2>This role is no longer listed</h2><p>You can still browse current openings.</p></article>}
    </main></>;
  }
  const checked = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    hour12: true, timeZone: 'Asia/Kolkata',
  }).format(listings.fetchedAt);

  return (
    <>
      <JobTable expiredIds={Array.from(expired)} cutoff={cutoff} jobs={jobs} fetchedAt={listings.fetchedAt} checked={checked} initial={initial} />
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
        <JobsContent initial={initial} role={String(searchParams.role || '')} />
      </Suspense>
    </div>
  );
}
