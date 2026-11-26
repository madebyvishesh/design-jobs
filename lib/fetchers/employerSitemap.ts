import type { Job } from '../../types/job';
import type { BoardListings } from '../boardFetch';
import { isDesignRole } from '../filterJobs';
import { salaryRange } from '../jobPay';
import { isAIFromCurated } from './curatedAI';
import type { WorkdayCompany } from './workday';

const indexes: Record<string, string> = {
  adobe: 'https://careers.adobe.com/us/en/sitemap.xml',
  autodesk: 'https://jobs.autodesk.com/careers/sitemap.xml?domain=autodesk.com',
  nvidia: 'https://jobs.nvidia.com/careers/sitemap.xml?domain=nvidia.com',
  paypal: 'https://paypal.eightfold.ai/careers/sitemap.xml?domain=paypal.com',
  hp: 'https://apply.hp.com/careers/sitemap.txt?domain=hp.com',
  mastercard: 'https://careers.mastercard.com/us/en/sitemap_index.xml',
  hpe: 'https://careers.hpe.com/us/en/sitemap_index.xml',
  cisco: 'https://careers.cisco.com/global/en/sitemap_index.xml',
  cvshealth: 'https://jobs.cvshealth.com/us/en/sitemap_index.xml',
  warnerbros: 'https://careers.wbd.com/global/en/sitemap.xml',
  target: 'https://corporate.target.com/sitemapjob.xml',
  comcast: 'https://jobs.comcast.com/jobs_sitemap.xml',
  blackrock: 'https://careers.blackrock.com/jobs_sitemap.xml',
  capitalone: 'https://www.capitalonecareers.com/jobs_sitemap.xml',
};

class FeedError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function readPublicPage(address: URL, origin: string): Promise<{ text: string; url: URL }> {
  let url = address;
  for (let hop = 0; hop < 5; hop++) {
    if (url.origin !== origin || url.username || url.password) throw new Error('Off-site feed link');
    const response = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(18000),
      headers: { 'User-Agent': 'DesignJobs/1.0 (+https://github.com/madebyvishesh/design-jobs)' } });
    if (response.ok && response.headers.get('cf-mitigated') !== 'challenge') return { text: await response.text(), url };
    await response.body?.cancel();
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.has('location')) {
      url = new URL(response.headers.get('location')!, url);
      continue;
    }
    throw new FeedError(response.status, 'HTTP ' + response.status + (response.headers.get('cf-mitigated') === 'challenge' ? ' challenge' : ''));
  }
  throw new Error('Too many redirects');
}

function decode(text: string) {
  return text.replace(/&(?:amp|quot|apos|lt|gt|nbsp|#39|#34);/g, token => ({
    '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&#39;': "'", '&#34;': '"',
  })[token] || token);
}

export function sitemapLinks(text: string, root: URL) {
  const xml = text.trim();
  const index = /<sitemapindex\b/i.test(xml.slice(0, 350));
  const plain = root.pathname.endsWith('.txt');
  const tag = index ? 'sitemapindex' : 'urlset';
  if (!plain && (!new RegExp('<' + tag + '\\b', 'i').test(xml.slice(0, 350)) || !xml.endsWith('</' + tag + '>'))) {
    throw new Error('Invalid or incomplete job sitemap');
  }
  const entries = plain ? xml.split(/\r?\n/).filter(Boolean) : Array.from(xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi), match => match[1]);
  const links = entries.map(entry => new URL(decode(entry.trim().replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1'))));
  if (links.some(url => url.origin !== root.origin || url.username || url.password)) throw new Error('Unexpected sitemap origin');
  return { index, links };
}

async function postingUrls(feed: URL) {
  const queue = [feed], read = new Set<string>(), postings = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (read.has(current.href)) continue;
    read.add(current.href);
    const page = await readPublicPage(current, feed.origin);
    const { index, links } = sitemapLinks(page.text, current);
    for (const url of links) {
      if (index) queue.push(url);
      else if (/\/jobs?\/[^/]+/i.test(url.pathname)) postings.add(url.href);
    }
  }
  return Array.from(postings);
}

type Value = Record<string, unknown>;
function record(value: unknown): Value {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Value : {};
}
function values(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}
function name(value: unknown): string {
  const label = typeof value === 'string' ? value : record(value).name;
  return typeof label === 'string' ? decode(label).trim() : '';
}

function structuredPostings(text: string): Value[] {
  const jobs: Value[] = [];
  for (const match of Array.from(text.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi))) {
    let data: unknown;
    try { data = JSON.parse(match[1]); } catch { continue; }
    for (const node of values(data)) {
      for (const item of [node, ...values(record(node)['@graph'])]) {
        if (values(record(item)['@type']).includes('JobPosting')) jobs.push(record(item));
      }
    }
  }
  return jobs;
}

export function readPosting(html: string, url: URL, company: WorkdayCompany, now = Date.now()): Job | undefined {
  const postings = structuredPostings(html);
  if (!postings.length) {
    if (/this (?:job|position) (?:has been filled|is no longer (?:available|open))|job you (?:applied to|are looking for) (?:has been|is no longer)/i.test(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' '))) return;
    throw new Error('JobPosting metadata unavailable');
  }
  if (postings.length !== 1) throw new Error('Expected one posting per detail page');
  const posting = postings[0], title = name(posting.title);
  if (!title) throw new Error('Missing posting title');
  const expiry = name(posting.validThrough);
  const expires = Date.parse(expiry);
  if (Number.isFinite(expires) && expires + (expiry.includes('T') ? 0 : 86400000) <= now) return;
  if (!isDesignRole(title)) return;
  const host = company.tenant + '.' + company.dc + '.myworkdayjobs.com';
  const workday = url.hostname === host || html.includes(host + '/' + company.site + '/job/') || html.includes(host + '/en-US/' + company.site + '/job/');
  const requisition = posting.identifier;
  const identifier = record(requisition).value ?? (typeof requisition === 'string' ? requisition : undefined);
  const alternate = url.pathname.match(/\/careers\/job\/(\d+)(?:-|\/|$)/)?.[1] || url.pathname;
  const id = typeof identifier === 'number' || typeof identifier === 'string' && identifier ? identifier : alternate;
  const places = values(posting.jobLocation).map(place => {
    const address = record(record(place).address);
    return [name(address.addressLocality), name(address.addressRegion), name(address.addressCountry)].filter(Boolean).join(', ') || name(place);
  }).filter(Boolean);
  const remote = values(posting.jobLocationType).includes('TELECOMMUTE');
  const regions = values(posting.applicantLocationRequirements).map(name).filter(Boolean);
  const location = Array.from(new Set(remote && regions.length ? regions : places)).join(' · ');
  const pay = record(posting.baseSalary), range = record(pay.value);
  const min = range.minValue ?? range.value, max = range.maxValue ?? range.value;
  const ats = workday ? 'workday' : 'employer';
  return {
    id: 'workday-' + company.tenant + '-' + id, title, company: company.name, companyDomain: company.domain,
    url: url.href, location, isRemote: remote || /\bremote\b/i.test(location),
    postedAt: name(posting.datePosted), dateKind: 'posted', department: '', ats, sources: [ats], isAI: isAIFromCurated(company.name),
    salary: salaryRange(typeof min === 'number' ? min : undefined, typeof max === 'number' ? max : undefined, name(pay.currency), name(range.unitText)),
  };
}

export async function fetchEmployerListings(company: WorkdayCompany): Promise<BoardListings> {
  const boardUrl = 'https://' + company.tenant + '.' + company.dc + '.myworkdayjobs.com/' + company.site + '/siteMap.xml';
  const feed = new URL(indexes[company.tenant] || boardUrl);
  const addresses = await postingUrls(feed);
  // These publishers include the title in their canonical job paths. Confirm every candidate against its JobPosting.
  const candidates = addresses.filter(address => isDesignRole(decodeURIComponent(new URL(address).pathname).replace(/[-_/]+/g, ' ')));
  const jobs: Job[] = [];
  let cursor = 0, failed = 0, lastError = '', stopped = false;
  async function readJobs() {
    while (!stopped && cursor < candidates.length) {
      const url = new URL(candidates[cursor++]);
      try {
        const page = await readPublicPage(url, feed.origin);
        const job = readPosting(page.text, page.url, company);
        if (job) jobs.push(job);
      } catch (error) {
        if (error instanceof FeedError && [404,410].includes(error.status)) continue;
        failed++;
        lastError = error instanceof Error ? error.message : 'Unknown error';
        if (error instanceof FeedError && [401,403,429].includes(error.status)) stopped = true;
      }
    }
  }
  await Promise.all([readJobs(), readJobs()]);
  const unresolved = failed + candidates.length - cursor;
  return { jobs, feed: feed.href, indexed: addresses.length,
    incomplete: unresolved ? unresolved + ' candidate page(s) unavailable: ' + lastError : undefined };
}
