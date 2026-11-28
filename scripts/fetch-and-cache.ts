/**
 * Fetches all design jobs from all sources and writes them to Vercel Blob.
 * Run via GitHub Actions twice an hour — no Vercel serverless limits apply.
 *
 * Usage: npx tsx scripts/fetch-and-cache.ts
 * Required env: BLOB_READ_WRITE_TOKEN
 */
import { hasCompletedJobBoard } from '../lib/boardFetch';
import { readPublisherSnapshot, setCachedJobs } from '../lib/jobsCache';
import { fetchAllDesignJobs } from '../lib/fetchAllJobs';

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error('Missing BLOB_READ_WRITE_TOKEN env var');
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Fetching all design jobs...`);
  const start = Date.now();

  const baseline = await readPublisherSnapshot();
  const prior = baseline?.snapshot;
  const previous = prior ? [...prior.aiJobs, ...prior.allJobs] : [];
  const { aiJobs, allJobs, report } = await fetchAllDesignJobs(previous);
  const total = aiJobs.length + allJobs.length;
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`Fetched ${total} jobs (${aiJobs.length} AI + ${allJobs.length} non-AI) in ${elapsed}s`);

  if (!hasCompletedJobBoard(report)) {
    console.error('No board could be read successfully; keeping the previous publication');
    process.exit(1);
  }

  for (const source of Array.from(new Set(report.map(b => b.source)))) {
    const boards = report.filter(b => b.source === source);
    console.log(source, JSON.stringify({ boards: boards.length, ok: boards.filter(b => b.status === 'ok').length, partial: boards.filter(b => b.status === 'partial').length, missing: boards.filter(b => b.status === 'missing').length, unavailable: boards.filter(b => b.status === 'unavailable').length, received: boards.reduce((n,b) => n + b.received,0) }));
  }
  const payload = { aiJobs, allJobs, report, fetchedAt: Date.now() };

  const snapshot = await setCachedJobs(payload, baseline);
  const jobs = [...snapshot.allJobs, ...snapshot.aiJobs];
  console.log('Excluded by six-month cutoff:', snapshot.expiredCount ?? 0);
  console.log('Published', jobs.length, 'roles, including', jobs.filter(j => j.lastVerifiedAt).length, 'last known listings from unavailable boards.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
