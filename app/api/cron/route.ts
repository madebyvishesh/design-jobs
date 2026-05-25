import { NextResponse } from 'next/server';
import { fetchAllDesignJobs } from '@/lib/fetchAllJobs';
import { setCachedJobs } from '@/lib/jobsCache';

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
  const jobs = await fetchAllDesignJobs();
  const total = jobs.aiJobs.length + jobs.allJobs.length;

  await setCachedJobs({ ...jobs, fetchedAt: Date.now() });

  return NextResponse.json({
    ok: true,
    total,
    ai: jobs.aiJobs.length,
    all: jobs.allJobs.length,
    durationMs: Date.now() - start,
  });
}
