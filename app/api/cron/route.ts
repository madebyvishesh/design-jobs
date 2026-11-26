import { NextResponse } from 'next/server';
import { fetchAllDesignJobs } from '@/lib/fetchAllJobs';
import { readPublisherSnapshot, setCachedJobs } from '@/lib/jobsCache';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> automatically.
  // Also allow a manual ?secret= query param for the first-run seed.
  const authHeader = request.headers.get('authorization');
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = authHeader === `Bearer ${cronSecret}`;
  const isManualTrigger = cronSecret && querySecret === cronSecret;

  if (cronSecret && !isVercelCron && !isManualTrigger) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  const baseline = await readPublisherSnapshot();
  const prior = baseline?.snapshot;
  const jobs = await fetchAllDesignJobs(prior ? [...prior.aiJobs, ...prior.allJobs] : []);

  if (!jobs.report.some(board => board.status === 'ok')) {
    return NextResponse.json({ error: 'No listings returned by sources' }, { status: 503 });
  }

  const snapshot = await setCachedJobs({ ...jobs, fetchedAt: Date.now() }, baseline);

  return NextResponse.json({
    ok: true,
    total: snapshot.aiJobs.length + snapshot.allJobs.length,
    ai: snapshot.aiJobs.length,
    all: snapshot.allJobs.length,
    expired: snapshot.expiredCount ?? 0,
    durationMs: Date.now() - start,
  });
}
