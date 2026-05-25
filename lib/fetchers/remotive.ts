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
    // Fetch both Design and Product categories
    const [designRes, productRes] = await Promise.allSettled([
      fetch('https://remotive.com/api/remote-jobs?category=Design&limit=100', {
        signal: controller.signal,
        next: { revalidate: 3600 },
      }),
      fetch('https://remotive.com/api/remote-jobs?category=Product&limit=100', {
        signal: controller.signal,
        next: { revalidate: 3600 },
      }),
    ]);

    const jobs: RemotiveJob[] = [];
    if (designRes.status === 'fulfilled' && designRes.value.ok) {
      const data: RemotiveResponse = await designRes.value.json();
      jobs.push(...(data.jobs ?? []));
    }
    if (productRes.status === 'fulfilled' && productRes.value.ok) {
      const data: RemotiveResponse = await productRes.value.json();
      jobs.push(...(data.jobs ?? []));
    }

    return jobs.map(job => ({
      id: `remotive-${job.id}`,
      title: job.title,
      company: job.company_name,
      companyDomain: '',
      logoUrl: job.company_logo ?? undefined,
      location: job.candidate_required_location ?? 'Remote',
      isRemote: true,
      url: job.url,
      postedAt: job.publication_date ?? new Date().toISOString(),
      department: job.category ?? '',
      ats: 'remotive' as AtsSource,
      sources: ['remotive' as AtsSource],
      isAI: isAIFromCurated(job.company_name),
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
