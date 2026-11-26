import { collectBoards, checkBoardResponse, readPages, type BoardReport } from '../boardFetch';
import type { Job, AtsSource } from '@/types/job';
import { isAIFromCurated } from './curatedAI';

// Workday exposes a public POST search API per tenant:
//   POST https://{tenant}.{dc}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
// A single-word search over-matches, so we run precise multi-word design
// queries and dedupe. Each company config is verified live before adding.

interface WorkdayCompany {
  tenant: string;
  dc: string;     // data-center subdomain, e.g. 'wd1', 'wd5', 'wd12'
  site: string;   // career-site path
  name: string;
  domain: string;
}

interface WorkdayPosting {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
}

interface WorkdayResponse {
  total?: number;
  jobPostings?: WorkdayPosting[];
}

// Precise design queries — Workday AND-matches multi-word terms, so these
// return small, on-target result sets rather than the whole board.
const DESIGN_QUERIES = [
  'product designer',
  'ux designer',
  'ui designer',
  'ux researcher',
  'design manager',
  'creative director',
  'brand designer',
  'graphic designer',
  'motion designer',
  'design engineer',
  'content designer',
  'visual designer',
];

// Verified-live Workday tenants (design-heavy, reputable companies)
const WORKDAY_COMPANIES: WorkdayCompany[] = [
  { tenant: 'nvidia', dc: 'wd5', site: 'NVIDIAExternalCareerSite', name: 'NVIDIA', domain: 'nvidia.com' },
  { tenant: 'adobe', dc: 'wd5', site: 'external_experienced', name: 'Adobe', domain: 'adobe.com' },
  { tenant: 'autodesk', dc: 'wd1', site: 'Ext', name: 'Autodesk', domain: 'autodesk.com' },
  { tenant: 'salesforce', dc: 'wd12', site: 'External_Career_Site', name: 'Salesforce', domain: 'salesforce.com' },
  { tenant: 'paypal', dc: 'wd1', site: 'jobs', name: 'PayPal', domain: 'paypal.com' },
  { tenant: 'workday', dc: 'wd5', site: 'Workday', name: 'Workday', domain: 'workday.com' },
  { tenant: 'mastercard', dc: 'wd1', site: 'CorporateCareers', name: 'Mastercard', domain: 'mastercard.com' },
  { tenant: 'hp', dc: 'wd5', site: 'ExternalCareerSite', name: 'HP', domain: 'hp.com' },
  { tenant: 'hpe', dc: 'wd5', site: 'Jobsathpe', name: 'Hewlett Packard Enterprise', domain: 'hpe.com' },
  { tenant: 'target', dc: 'wd5', site: 'targetcareers', name: 'Target', domain: 'target.com' },
  { tenant: 'comcast', dc: 'wd5', site: 'Comcast_Careers', name: 'Comcast', domain: 'comcast.com' },
  { tenant: 'warnerbros', dc: 'wd5', site: 'global', name: 'Warner Bros. Discovery', domain: 'wbd.com' },
  { tenant: 'zillow', dc: 'wd5', site: 'Zillow_Group_External', name: 'Zillow', domain: 'zillow.com' },
  { tenant: 'gilead', dc: 'wd1', site: 'gileadcareers', name: 'Gilead Sciences', domain: 'gilead.com' },
  { tenant: 'blackrock', dc: 'wd1', site: 'BlackRock_Professional', name: 'BlackRock', domain: 'blackrock.com' },
  { tenant: 'capitalone', dc: 'wd12', site: 'Capital_One', name: 'Capital One', domain: 'capitalone.com' },
  { tenant: 'cisco', dc: 'wd5', site: 'cisco_careers', name: 'Cisco', domain: 'cisco.com' },
  { tenant: 'cvshealth', dc: 'wd1', site: 'CVS_Health_Careers', name: 'CVS Health', domain: 'cvshealth.com' },
];

// "Posted 5 Days Ago" / "Posted Today" / "Posted 30+ Days Ago" -> ISO date
function parsePostedOn(text?: string): string {
  if (!text) return new Date(0).toISOString();
  const lower = text.toLowerCase();
  if (lower.includes('today')) return new Date().toISOString();
  if (lower.includes('yesterday')) return new Date(Date.now() - 864e5).toISOString();
  const match = lower.match(/(\d+)\+?\s*days?/);
  if (match) {
    const days = parseInt(match[1], 10);
    return new Date(Date.now() - days * 864e5).toISOString();
  }
  return new Date(0).toISOString();
}

async function fetchWorkdayQuery(
  company: WorkdayCompany,
  query: string,
): Promise<WorkdayPosting[]> {
  const url = `https://${company.tenant}.${company.dc}.myworkdayjobs.com/wday/cxs/${company.tenant}/${company.site}/jobs`;
  return readPages<WorkdayPosting>(async offset => {
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: query }),
      signal: AbortSignal.timeout(15000), next: { revalidate: 3600 },
    });
    checkBoardResponse(res);
    const data: WorkdayResponse = await res.json();
    if (!Array.isArray(data.jobPostings)) throw new Error('Missing jobPostings array');
    return { items: data.jobPostings, total: data.total };
  }, posting => posting.externalPath);
}

async function fetchWorkdayCompany(company: WorkdayCompany): Promise<Job[]> {
  const byPath = new Map<string, WorkdayPosting>();
  for (const query of DESIGN_QUERIES) {
    for (const posting of await fetchWorkdayQuery(company, query)) {
      if (posting.externalPath && !byPath.has(posting.externalPath)) {
        byPath.set(posting.externalPath, posting);
      }
    }
  }

  const base = `https://${company.tenant}.${company.dc}.myworkdayjobs.com/${company.site}`;
  return Array.from(byPath.values()).map(posting => {
    const loc = posting.locationsText ?? '';
    const jobId = posting.bulletFields?.[0] ?? posting.externalPath.split('_').pop() ?? posting.externalPath;
    return {
      id: `workday-${company.tenant}-${jobId}`,
      title: posting.title,
      company: company.name,
      companyDomain: company.domain,
      location: loc,
      isRemote: loc.toLowerCase().includes('remote'),
      url: `${base}${posting.externalPath}`,
      postedAt: parsePostedOn(posting.postedOn),
      department: '',
      ats: 'workday' as AtsSource,
      sources: ['workday' as AtsSource],
      isAI: isAIFromCurated(company.name),
    };
  });
}

export function fetchAllWorkdayJobs(report: BoardReport[] = []) {
  return collectBoards('workday', WORKDAY_COMPANIES, c => ({ board: c.tenant, domain: c.domain }), fetchWorkdayCompany, report, 3);
}
