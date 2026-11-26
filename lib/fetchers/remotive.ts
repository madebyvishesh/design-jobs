import type { Job, AtsSource } from '@/types/job';
import { isAIFromCurated } from './curatedAI';

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
}

interface RemotiveResponse {
  'job-count'?: number;
  jobs?: RemotiveJob[];
}

export async function fetchRemotiveJobs(): Promise<Job[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('https://remotive.com/api/remote-jobs', { signal: controller.signal, next: { revalidate: 3600 } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { jobs }: RemotiveResponse = await res.json();
    if (!Array.isArray(jobs)) throw new Error('Missing jobs array');
    return jobs.map(job => ({
      id: `remotive-${job.id}`,
      title: job.title,
      company: job.company_name,
      companyDomain: '',
      logoUrl: job.company_logo ?? undefined,
      location: job.candidate_required_location ?? 'Remote',
      isRemote: true,
      workplace: 'remote', employment: job.job_type,
      salary: job.salary?.trim() || undefined,
      url: job.url,
      postedAt: job.publication_date ?? new Date(0).toISOString(),
      department: job.category ?? '',
      ats: 'remotive' as AtsSource,
      sources: ['remotive' as AtsSource],
      isAI: isAIFromCurated(job.company_name),
    }));
  } finally {
    clearTimeout(timeout);
  }
}
