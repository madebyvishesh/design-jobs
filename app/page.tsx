import { Suspense, cache } from 'react';
import { unstable_cache } from 'next/cache';
import { fetchAllDesignJobs } from '@/lib/fetchAllJobs';
import { getCachedJobs } from '@/lib/jobsCache';
import RefreshListings from '@/components/RefreshListings';
import JobTable from '@/components/JobTable';
import { classifyDate } from '@/lib/jobDates';
import { isDesignRole } from '@/lib/filterJobs';
import ThemeToggle from '@/components/ThemeToggle';

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

let pendingFetch: ReturnType<typeof fetchSnapshot> | undefined;

const getListings = cache(async () => {
  const published = await getCachedJobs();
  const now = Date.now();
  if (published && now - published.fetchedAt < refreshInterval) return published;

  // Share the fallback across visits without overwriting the scheduled publication.
  const window = String(Math.floor(now / refreshInterval));
  const getFallback = unstable_cache(fetchSnapshot, ['listings-fallback', window], { revalidate: 1800 });
  try {
    pendingFetch ??= getFallback().finally(() => { pendingFetch = undefined; });
    return await pendingFetch;
  } catch (error) {
    console.error('Listings refresh failed', error);
    return published;
  }
});

async function JobsContent() {
  const listings = await getListings();
  if (!listings) return (
    <div className="board-empty" role="status">
      <h2>Listings are temporarily unavailable</h2>
      <p>Try again in a few minutes.</p>
      <a className="board-control" href="/">Retry</a>
      <RefreshListings fetchedAt={0} interval={refreshInterval} />
    </div>
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
      <JobTable jobs={jobs} fetchedAt={listings.fetchedAt} checked={checked} />
      <RefreshListings fetchedAt={listings.fetchedAt} interval={refreshInterval} />
    </>
  );
}

export default function Home() {
  return (
    <div className="board-shell">
      <header className="board-header surface-grid">
        <div className="board-width board-masthead">
          <div>
            <h1>Design Jobs</h1>
            <p>Product, UX, brand, motion and design engineering roles.</p>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main id="jobs" className="board-width board-main">
        <Suspense fallback={<p role="status" className="board-loading">Loading listings…</p>}>
          <JobsContent />
        </Suspense>
      </main>
      <footer className="board-width board-footer">Listings from YC, Ashby, Greenhouse, Workday, Lever and Remotive.</footer>
    </div>
  );
}
