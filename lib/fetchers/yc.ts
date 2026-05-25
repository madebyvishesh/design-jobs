import type { Job, AtsSource } from '@/types/job';

// YC Work at a Startup uses Inertia.js — the designer jobs page returns JSON
// when X-Inertia header is present. No auth or cookies needed.
const INERTIA_VERSION = '2dea8239f2284f6bb848d0eda4dc3b5f7c0c2893';
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const AI_KEYWORDS = ['ai', 'llm', 'gpt', 'ml', 'generative', 'neural', 'machine learning', 'deep learning'];
const AI_TAGS = ['artificial intelligence', 'machine learning', 'generative ai'];

interface YCJob {
  id: number;
  title: string;
  jobType: string;
  location: string;
  roleType: string;
  salary?: string;
  companyName: string;
  companySlug: string;
  companyBatch?: string;
  companyOneLiner?: string;
  companyLogoUrl?: string;
  companyLastActiveAt?: string | null;
  applyUrl: string;
}

function isAIFromYC(job: YCJob): boolean {
  const text = `${job.companyName} ${job.companyOneLiner ?? ''}`.toLowerCase();
  return AI_KEYWORDS.some(kw => text.includes(kw)) || AI_TAGS.some(t => text.includes(t));
}

function extractDomain(slug: string): string {
  // Many YC companies use slug.com — fallback to empty so Google favicon is skipped
  return '';
}

async function fetchYCPage(path: string): Promise<YCJob[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`https://www.workatastartup.com${path}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'application/json, text/plain, */*',
        'X-Inertia': 'true',
        'X-Inertia-Version': INERTIA_VERSION,
        'Referer': 'https://www.workatastartup.com/jobs',
      },
      // No ISR cache — this page changes hourly
      cache: 'no-store',
    });

    // 409 = Inertia version mismatch — fall back to parsing the HTML page
    if (res.status === 409 || !res.ok) {
      return await fetchYCPageFromHTML(path);
    }

    const data = await res.json() as { props?: { jobs?: YCJob[] } };
    return data.props?.jobs ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/** Fallback: fetch the HTML page and extract jobs from the data-page attribute */
async function fetchYCPageFromHTML(path: string): Promise<YCJob[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`https://www.workatastartup.com${path}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const html = await res.text();
    const match = html.match(/data-page="([^"]+)"/);
    if (!match) return [];
    const decoded = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'");
    const pageData = JSON.parse(decoded) as { props?: { jobs?: YCJob[] } };
    return pageData.props?.jobs ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchYCJobs(): Promise<Job[]> {
  // Fetch designer and product roles (may contain design roles)
  const [designerJobs, productJobs] = await Promise.allSettled([
    fetchYCPage('/jobs/l/designer'),
    fetchYCPage('/jobs/l/product-manager'),
  ]);

  const allJobs: YCJob[] = [
    ...(designerJobs.status === 'fulfilled' ? designerJobs.value : []),
    ...(productJobs.status === 'fulfilled' ? productJobs.value : []),
  ];

  const seen = new Set<number>();
  return allJobs
    .filter(j => {
      if (seen.has(j.id)) return false;
      seen.add(j.id);
      return true;
    })
    .map(job => {
      const isRemote = job.location.toLowerCase().includes('remote');
      return {
        id: `yc-${job.id}`,
        title: job.title,
        company: job.companyName,
        companyDomain: '',
        logoUrl: job.companyLogoUrl ?? undefined,
        location: job.location.replace(/ \/ Remote.*$/, '').replace(/, US$/, '').trim(),
        isRemote,
        url: `https://www.workatastartup.com/jobs/${job.id}`,
        // companyLastActiveAt is company activity time, not job posting date — best available from YC API
        postedAt: job.companyLastActiveAt ?? new Date(0).toISOString(),
        department: job.roleType ?? '',
        ats: 'yc' as AtsSource,
        sources: ['yc' as AtsSource],
        isAI: isAIFromYC(job),
        batch: job.companyBatch ?? undefined,
      };
    });
}
