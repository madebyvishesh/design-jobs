/**
 * Fetches all design jobs from all sources and writes them to Vercel Blob.
 * Run via GitHub Actions every hour — no Vercel serverless limits apply.
 *
 * Usage: npx tsx scripts/fetch-and-cache.ts
 * Required env: BLOB_READ_WRITE_TOKEN
 */
import { put } from '@vercel/blob';
import { fetchAllDesignJobs } from '../lib/fetchAllJobs';

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error('Missing BLOB_READ_WRITE_TOKEN env var');
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Fetching all design jobs...`);
  const start = Date.now();

  const { aiJobs, allJobs } = await fetchAllDesignJobs();
  const total = aiJobs.length + allJobs.length;
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`Fetched ${total} jobs (${aiJobs.length} AI + ${allJobs.length} non-AI) in ${elapsed}s`);

  if (total === 0) {
    console.error('Got 0 jobs — aborting to avoid overwriting a good cache with empty data');
    process.exit(1);
  }

  const payload = { aiJobs, allJobs, fetchedAt: Date.now() };

  const blob = await put('design-jobs-cache.json', JSON.stringify(payload), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
    token,
  });

  console.log(`Cache written to: ${blob.url}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
