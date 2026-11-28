import { createHash } from 'node:crypto';
import { load, type CheerioAPI } from 'cheerio';
import { collectBoards, readBoardJson, type BoardListings, type BoardReport } from '../boardFetch';
import { isDesignRole } from '../filterJobs';
import type { AtsSource, Job } from '../../types/job';

const koto = 'https://koto.com/careers';
const porto = 'https://www.portorocha.com/about';
const pentagram = 'https://www.pentagram.com/careers';
const base = 'https://www.basedesign.com/jobs';
const workableStudios = [
  ['jones-knowles-ritchie', 'Jones Knowles Ritchie', 'jkrglobal.com'],
  ['wolff-olins', 'Wolff Olins', 'wolffolins.com'],
  ['moving-brands', 'Moving Brands', 'movingbrands.com'],
  ['designstudio', 'DesignStudio', 'design.studio'],
  ['ustwo', 'ustwo', 'ustwo.com'],
];
const tbi = 'https://the-brandidentity.com/jobs';
const openRoles = 'https://openrol.es/';

// Directories can introduce smaller studios with disclosed pay. Unpriced jobs
// are limited to selected employers, matched on the publisher's company field.
const established = new Set([
  'porto rocha',
  'koto',
  'jones knowles ritchie',
  'moving brands',
  'design bridge and partners',
  'huge',
  'code and theory',
  'pentagram',
  'landor',
  'metalab',
  'dept',
  'collins',
  'wolff olins',
  'designstudio',
  'ragged edge',
  'buck',
  'ustwo',
  'akqa',
  'instrument',
  'work & co',
  'dixonbaxi',
  'base design',
  'a practice for everyday life',
  'zak group',
  'ok-rm',
  'feels like',
  'random studio',
  'akris ag',
  'dazed',
]);

// Open Roles links straight off-site. Verify only known employer destinations.
const openEmployers: Record<string, [string, string]> = {
  'PORTO ROCHA': ['portorocha.com', 'www.portorocha.com'],
  Pentagram: ['pentagram.com', 'www.pentagram.com'],
  Koto: ['koto.com', 'koto.com'],
  COLLINS: ['wearecollins.com', 'www.wearecollins.com'],
  'Wolff Olins': ['wolffolins.com', 'www.wolffolins.com'],
  DixonBaxi: ['dixonbaxi.com', 'www.dixonbaxi.com'],
  'Ragged Edge': ['raggededge.com', 'raggededge.com'],
  'Base Design': ['basedesign.com', 'www.basedesign.com'],
  BUCK: ['buck.co', 'buck.co'],
  'Feels Like': ['feelslike.studio', 'feelslike.studio'],
  'Zak Group': ['zak.group', 'www.zak.group'],
  'New Genre': ['newgenre.studio', 'www.newgenre.studio'],
  'A Practice for Everyday Life': ['apracticeforeverydaylife.com', 'apracticeforeverydaylife.com'],
  'Random Studio': ['random.studio', 'randomstudio.bamboohr.com'],
  Dazed: ['dazedmedia.com', 'careers.dazedmedia.com'],
  'Akris AG': ['akris.com', 'my.jobalino.ch'],
  'New Territory': ['newterritory.studio', 'newterritory.studio'],
  'N4 Studio Ltd': ['n4.studio', 'www.n4.studio'],
};
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const cash = (value: string) => /(?:[$£€₹]\s*\d|\d[\d,.]*[kK]?\s*(?:USD|GBP|EUR|CAD|AUD|INR)\b)/i.test(value);
function role(title: string) {
  return (
    isDesignRole(title) &&
    !/future opportunities|talent pool|open application|expression of interest|enquir(?:y|ies)/i.test(title)
  );
}
function eligible(company: string, salary?: string) {
  return established.has(clean(company).toLowerCase()) || Boolean(salary && cash(salary));
}
function field($: CheerioAPI, label: string) {
  return clean(
    $('dt')
      .filter((_, e) => clean($(e).text()) === label)
      .first()
      .next('dd')
      .text(),
  );
}
function dateLimit(text: string) {
  const match =
    /(?:by|deadline\s*:?|closes?\s*:?)\s+((?:[a-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+\d{4})|(?:\d{1,2}(?:st|nd|rd|th)?\s+[a-z]{3,9}\s+\d{4}))/i.exec(
      text,
    );
  if (!match) return undefined;
  const day = Date.parse(match[1].replace(/(\d)(st|nd|rd|th)/i, '$1') + ' 23:59:59 GMT');
  return Number.isFinite(day) ? new Date(day).toISOString() : undefined;
}
async function html(address: string) {
  const origin = new URL(address).origin;
  let url = address;
  for (let n = 0; n < 5; n++) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(18000),
      cache: 'no-store',
      headers: { 'User-Agent': 'DesignJobs/1.0 (+https://github.com/madebyvishesh/design-jobs)' },
    });
    if (res.ok && !res.headers.get('cf-mitigated')) return load(await res.text());
    await res.body?.cancel();
    if (res.status === 404 || res.status === 410) return null;
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      const next = new URL(res.headers.get('location')!, url);
      if (next.origin !== origin) throw new Error('Changed publisher origin');
      url = next.href;
      continue;
    }
    throw new Error('HTTP ' + res.status);
  }
  throw new Error('Too many redirects');
}
type Entry = Pick<Job, 'title' | 'company' | 'companyDomain' | 'url'> &
  Partial<
    Pick<Job, 'location' | 'salary' | 'employment' | 'workplace' | 'postedAt' | 'isRemote' | 'validThrough'>
  >;
function listing(ats: AtsSource, data: Entry): Job {
  return {
    id: ats + '-' + createHash('sha256').update(data.url).digest('hex').slice(0, 24),
    department: '',
    postedAt: '',
    location: '',
    isRemote: false,
    ...data,
    dateKind: data.postedAt ? 'posted' : 'unknown',
    ats,
    sources: [ats],
    isAI: false,
  };
}
type Candidate = { url: string; title: string; location?: string; entry?: Entry };
async function details(
  index: string,
  candidates: Candidate[],
  parse: (c: Candidate, $: CheerioAPI) => Job | null,
): Promise<BoardListings> {
  const unique = Array.from(new Map(candidates.map((c) => [c.url, c])).values());
  const jobs: Job[] = [],
    failed: string[] = [];
  let i = 0;
  async function worker() {
    while (i < unique.length) {
      const c = unique[i++];
      try {
        const $ = await html(c.url);
        if (!$) continue;
        const job = parse(c, $);
        if (job && (!job.validThrough || Date.parse(job.validThrough) >= Date.now())) jobs.push(job);
      } catch {
        failed.push(c.url);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, unique.length) }, worker));
  return {
    jobs,
    feed: index,
    indexed: unique.length,
    ...(failed.length
      ? { incomplete: failed.length + ' unreadable role pages', unverifiedUrls: failed }
      : {}),
  };
}
async function indexPage(url: string) {
  const $ = await html(url);
  if (!$) throw new Error('Career index unavailable');
  return $;
}
async function studioIndex(index: string) {
  const $ = await indexPage(index);
  const isKoto = index === koto,
    isPorto = index === porto;
  const company = isKoto ? 'Koto' : isPorto ? 'PORTO ROCHA' : 'Pentagram';
  const selector = isKoto
    ? 'a[href^="/careers/"]'
    : isPorto
      ? '.about__openings a[href]'
      : '[aria-labelledby="rolesHeading"] a[href]';
  const marker = isKoto
    ? $('body').text().includes('Open roles')
    : isPorto
      ? $('.about__openings').length
      : $('#rolesHeading').length;
  if (!marker) throw new Error('Missing open positions section');
  const candidates: Candidate[] = [];
  for (const el of $(selector).toArray()) {
    const a = $(el),
      url = new URL(a.attr('href')!, index);
    const title = clean(isKoto ? a.find('p').first().find('span span').first().text() : a.text());
    if (!title) throw new Error('Missing listing title');
    if (!role(title) || url.origin !== new URL(index).origin) continue;
    candidates.push({
      title,
      url: url.href,
      location: isKoto ? clean(a.find('p').first().find('span span').last().text()) : '',
    });
  }
  return details(index, candidates, (c, page) => {
    let salary = '',
      location = c.location || '',
      validThrough: string | undefined;
    if (isKoto) {
      const h = page('h1')
        .filter((_, e) => clean(page(e).text()) === c.title)
        .last();
      if (!h.length || !page('a[href*="/applications/new"]').length) throw new Error('Missing role details');
      salary = clean(h.next('p').text());
    } else if (isPorto) {
      const value = (label: string) =>
        clean(
          page('h2,h3')
            .filter((_, e) => clean(page(e).text()) === label)
            .first()
            .next()
            .text(),
        );
      const how = value('How to Apply');
      if (!how) throw new Error('Missing application instructions');
      validThrough = dateLimit(how);
      location = value('Location');
      salary = value('Salary');
    } else {
      const main = clean(page('main').text());
      if (!main.toLowerCase().includes(c.title.toLowerCase())) throw new Error('Missing position title');
      validThrough = dateLimit(main);
    }
    return listing('employer', {
      title: c.title,
      url: c.url,
      company,
      companyDomain: new URL(index).hostname.replace(/^www\./, ''),
      location,
      isRemote: /\bremote\b/i.test(location),
      salary: /\d/.test(salary) ? salary : undefined,
      validThrough,
    });
  });
}
async function baseDesign() {
  const $ = await indexPage(base);
  if (!/work with us/i.test($('h1,h2').text())) throw new Error('Missing Base Design career index');
  const candidates: Candidate[] = [];
  for (const e of $('a[href^="/jobs/"]').toArray()) {
    const fields = $(e)
      .children('span')
      .map((_, child) => clean($(child).text()))
      .get();
    const [title, location, employment] = fields;
    if (!title) throw new Error('Missing Base Design role');
    if (!role(title)) continue;
    const url = new URL($(e).attr('href')!, base).href;
    candidates.push({
      title,
      url,
      entry: { title, url, location, employment, company: 'Base Design', companyDomain: 'basedesign.com' },
    });
  }
  return details(base, candidates, (c, page) => {
    page('script,style,nav,footer').remove();
    const text = clean(page('body').text());
    if (!text.toLowerCase().includes(c.title.toLowerCase()) || !/apply|application/i.test(text))
      throw new Error('Missing Base Design application');
    if (/applications (?:are |have )?closed|no longer accepting/i.test(text)) return null;
    return listing('employer', { ...c.entry!, validThrough: dateLimit(text) });
  });
}

interface WorkableRole {
  title: string;
  url: string;
  employment_type?: string;
  telecommuting?: boolean;
  published_on?: string;
  locations: { city?: string; country?: string; hidden?: boolean }[];
}
async function workableStudio([slug, company, companyDomain]: string[]) {
  const feed = 'https://www.workable.com/api/accounts/' + slug + '?details=true';
  const board = await readBoardJson<{ name: string; jobs: WorkableRole[] }>(feed);
  if (board.name !== company || !Array.isArray(board.jobs)) throw new Error('Unexpected Workable account');
  const jobs = board.jobs
    .filter((j) => role(j.title))
    .map((j) => {
      if (!j.url.startsWith('https://apply.workable.com/'))
        throw new Error('Unexpected Workable application link');
      const location = j.locations
        .filter((loc) => !loc.hidden)
        .map((loc) => [loc.city, loc.country].filter(Boolean).join(', '))
        .join(' · ');
      return listing('employer', {
        title: j.title,
        url: j.url,
        company,
        companyDomain,
        location,
        employment: j.employment_type,
        postedAt: j.published_on || '',
        isRemote: j.telecommuting === true,
      });
    });
  return { feed, jobs, indexed: board.jobs.length };
}
async function brandIdentity() {
  const candidates: Candidate[] = [],
    seen = new Set<string>();
  let index: string | undefined = tbi;
  while (index) {
    if (seen.has(index)) throw new Error('Repeated board page');
    seen.add(index);
    const $ = await indexPage(index);
    if (!/All roles|No roles|No jobs/i.test($('main').text() || $('body').text()))
      throw new Error('Missing job index');
    for (const e of $('a[href^="/jobs/roles/"]').toArray()) {
      const title = clean($(e).text()),
        url = new URL($(e).attr('href')!, tbi);
      if (role(title)) candidates.push({ title, url: url.href });
    }
    const next = $('a[rel="next"], a[aria-label="Next page"]').first().attr('href');
    index = next ? new URL(next, tbi).href : undefined;
    if (index && new URL(index).origin !== new URL(tbi).origin) throw new Error('Invalid board pagination');
  }
  return details(tbi, candidates, (c, $) => {
    const data = $('script[type="application/ld+json"]')
      .toArray()
      .map((e) => JSON.parse($(e).text()))
      .find((x) => x?.['@type'] === 'JobPosting');
    if (!data?.hiringOrganization?.name || typeof data.title !== 'string')
      throw new Error('Missing listing data');
    const company = String(data.hiringOrganization.name),
      salary = field($, 'Salary'),
      location = field($, 'Location'),
      contract = field($, 'Contract');
    if (!role(data.title) || !eligible(company, salary)) return null;
    const website = data.hiringOrganization.sameAs;
    return listing('tbi', {
      url: c.url,
      title: data.title,
      company,
      companyDomain:
        typeof website === 'string' && URL.canParse(website)
          ? new URL(website).hostname.replace(/^www\./, '')
          : '',
      salary: cash(salary) ? salary : undefined,
      location,
      employment: contract.split(',')[0],
      workplace: contract.split(',').slice(1).join(',').trim(),
      isRemote: data.jobLocationType === 'TELECOMMUTE' || /^remote/i.test(location),
      postedAt: data.datePosted || '',
      validThrough: data.validThrough,
    });
  });
}
async function openRolesBoard() {
  const $ = await indexPage(openRoles),
    candidates: Candidate[] = [];
  const links = $('a[data-framer-name]').filter(
    (_, e) => $(e).find('img[alt="Job listing profile photo"]').length > 0,
  );
  if (!links.length) throw new Error('Missing Open Roles listings');
  for (const e of links.toArray()) {
    const [title, company, location, employment, ...tags] = $(e)
      .find('p')
      .map((_, p) => clean($(p).text()))
      .get();
    const employer = openEmployers[company],
      salary = tags.find(cash);
    if (!employer || !role(title) || !eligible(company, salary)) continue;
    const address = $(e).attr('href') || '';
    if (!URL.canParse(address)) continue;
    const url = new URL(address);
    if (url.protocol !== 'https:' || url.host !== employer[1] || url.username || url.password) continue;
    const workplace = tags.filter((tag) => /^(remote|hybrid|on.site)$/i.test(tag)).join(', ');
    candidates.push({
      title,
      url: url.href,
      entry: {
        title,
        company,
        location,
        employment,
        workplace,
        isRemote: /remote/i.test(workplace + ' ' + location),
        companyDomain: employer[0],
        salary,
        url: url.href,
      },
    });
  }
  return details(openRoles, candidates, (c, $) => {
    $('script,style,nav,footer').remove();
    const text = clean($('main').text() || $('body').text());
    if (
      /(?:no longer (?:accepting|available)|applications (?:are |have )?closed|position has been filled)/i.test(
        text,
      )
    )
      return null;
    if (
      !/apply|applications|send (?:us |your )|join@/i.test(text) ||
      !text.toLowerCase().includes(c.title.toLowerCase())
    )
      return null;
    return listing('openroles', { ...c.entry!, validThrough: dateLimit(text) });
  });
}
export async function fetchStudioJobs(report: BoardReport[]) {
  const ids = (address: string) => ({
    board: new URL(address).hostname.replace(/^www\./, ''),
    domain: new URL(address).hostname.replace(/^www\./, ''),
  });
  const groups = await Promise.all([
    collectBoards('employer', [porto, koto, pentagram], ids, studioIndex, report, 3),
    collectBoards('tbi', [tbi], ids, brandIdentity, report),
    collectBoards('openroles', [openRoles], ids, openRolesBoard, report),
    collectBoards('employer', [base], ids, baseDesign, report),
    collectBoards(
      'employer',
      workableStudios,
      ([, , domain]) => ({ board: domain, domain }),
      workableStudio,
      report,
      3,
    ),
  ]);
  const [studioJobs, brandJobs, openJobs, baseJobs, workableJobs] = groups;
  // One directory may link its own posting while the other links the employer.
  // Require a unique match and the same known employer domain before merging.
  function sameListing(a: Job, b: Job) {
    const normalized = (v: string) => clean(v).toLowerCase();
    const placeA = normalized(a.location),
      placeB = normalized(b.location);
    return Boolean(
      a.companyDomain &&
        a.companyDomain === b.companyDomain &&
        normalized(a.title) === normalized(b.title) &&
        placeA &&
        placeB &&
        (placeA === placeB || placeA.startsWith(placeB + ',') || placeB.startsWith(placeA + ',')),
    );
  }
  const mergedOpenUrls = new Set<string>();
  const combined = brandJobs.map((brand) => {
    const matches = openJobs.filter((open) => sameListing(brand, open));
    const open = matches[0];
    if (matches.length !== 1 || brandJobs.filter((other) => sameListing(other, open)).length !== 1)
      return brand;
    mergedOpenUrls.add(open.url);
    return {
      ...brand,
      sources: [...brand.sources, ...open.sources],
      salary: brand.salary || open.salary,
    };
  });
  return [
    ...studioJobs,
    ...baseJobs,
    ...workableJobs,
    ...combined,
    ...openJobs.filter((job) => !mergedOpenUrls.has(job.url)),
  ];
}
