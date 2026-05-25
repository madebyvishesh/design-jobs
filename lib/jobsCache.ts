import type { Job } from '@/types/job';

interface JobsPayload {
  aiJobs: Job[];
  allJobs: Job[];
  fetchedAt: number;
}

const KV_KEY = 'design_jobs_v1';
const KV_TTL = 7200; // 2 hours

/** Returns true when Vercel KV env vars are present */
function isKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function getCachedJobs(): Promise<JobsPayload | null> {
  if (!isKvConfigured()) return null;
  try {
    const { kv } = await import('@vercel/kv');
    const data = await kv.get<JobsPayload>(KV_KEY);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function setCachedJobs(payload: JobsPayload): Promise<void> {
  if (!isKvConfigured()) return;
  try {
    const { kv } = await import('@vercel/kv');
    await kv.set(KV_KEY, payload, { ex: KV_TTL });
  } catch {
    // Silently skip if KV is misconfigured — don't crash the page
  }
}
