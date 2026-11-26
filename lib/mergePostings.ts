import type { Job } from '@/types/job';
import { classifyDate, preferredDate } from './jobDates';

function postingUrl(job: Job) {
  if (!URL.canParse(job.url)) return job.id;
  const url = new URL(job.url);
  if (url.pathname.split('/').filter(Boolean).length < 2 && !url.searchParams.has('gh_jid')) return job.id;
  for (const key of Array.from(url.searchParams.keys())) {
    if (key.startsWith('utm_') || key === 'gh_src') url.searchParams.delete(key);
  }
  if (url.hostname === 'jobs.ashbyhq.com') url.pathname = url.pathname.replace(/\/application\/?$/, '');
  url.hash = '';
  return url.href.replace(/\/$/, '');
}

export function mergePostings(raw: Job[]) {
  const byUrl = new Map<string, Job>();
  const ids = new Set<string>();
  for (const entry of raw) {
    if (ids.has(entry.id)) continue;
    ids.add(entry.id);
    const job = { ...entry, ...classifyDate(entry, true) };
    const key = postingUrl(job);
    const old = byUrl.get(key);
    if (!old) { byUrl.set(key, job); continue; }
    const direct = old.ats === 'yc' || old.ats === 'remotive' ? job : old;
    byUrl.set(key, { ...direct, sources: Array.from(new Set([...old.sources, ...job.sources])),
      batch: direct.batch || old.batch || job.batch, salary: direct.salary || old.salary || job.salary,
      logoUrl: direct.logoUrl || old.logoUrl || job.logoUrl, ...preferredDate(old, job) });
  }
  return Array.from(byUrl.values());
}
