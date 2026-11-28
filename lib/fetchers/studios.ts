import { createHash } from 'node:crypto';
import { load, type CheerioAPI } from 'cheerio';
import { collectBoards, readBoardJson, type BoardListings, type BoardReport } from '../boardFetch';
import { studioDomains, studioName } from './studioDirectory';
import { isDesignRole } from '../filterJobs';
import type { AtsSource, Job } from '../../types/job';

const koto = 'https://koto.com/careers';
const porto = 'https://www.portorocha.com/about';
const pentagram = 'https://www.pentagram.com/careers';
const base = 'https://www.basedesign.com/jobs';
const workableStudios = [
  ['nexusstudios', 'Nexus Studios', 'nexusstudios.com'],
  ['wearebulletproof', 'Bulletproof', 'wearebulletproof.com'],
  ['jones-knowles-ritchie', 'Jones Knowles Ritchie', 'jkrglobal.com'],
  ['wolff-olins', 'Wolff Olins', 'wolffolins.com'],
  ['moving-brands', 'Moving Brands', 'movingbrands.com'],
  ['designstudio', 'DesignStudio', 'design.studio'],
  ['ustwo', 'ustwo', 'ustwo.com'],
];
const openRoles = 'https://openrol.es/';

// Directories can introduce smaller studios with disclosed pay. Unpriced jobs
// are limited to selected employers, matched on the publisher's company field.
const established = new Set([
  'art&graft',
  'found studio',
  'builders club',
  'locomotive',
  'hornet',
  'nexus studios',
  'territory studio',
  'goldenwolf',
  'brand new school',
  'futuredeluxe',
  'giant ant',
  'manvsmachine',
  'tendril',
  'interbrand',
  'bulletproof',
  'studio dumbar',
  'studio dumbar/dept',
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
const employerHosts: Record<string, [string, string]> = {
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
  Storetasker: ['storetasker.com', 'storetasker.notion.site'],
  Recraft: ['recraft.ai', 'jobs.ashbyhq.com'],
  'New Genre': ['newgenre.studio', 'www.newgenre.studio'],
  'A Practice for Everyday Life': ['apracticeforeverydaylife.com', 'apracticeforeverydaylife.com'],
  'Random Studio': ['random.studio', 'randomstudio.bamboohr.com'],
  Dazed: ['dazedmedia.com', 'careers.dazedmedia.com'],
  'Akris AG': ['akris.com', 'my.jobalino.ch'],
  'New Territory': ['newterritory.studio', 'newterritory.studio'],
  'N4 Studio Ltd': ['n4.studio', 'www.n4.studio'],
};
const openEmployers = new Map(Object.entries(employerHosts).map(([name, host]) => [studioName(name), host]));
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const cash = (value: string) => /(?:[$£€₹]\s*\d|\d[\d,.]*[kK]?\s*(?:USD|GBP|EUR|CAD|AUD|INR)\b)/i.test(value);
export function role(title: string, domain = '') {
  return (
    isDesignRole(title, '', domain) &&
    !/future opportunities|talent pool|open application|general application|general interest|join our network|super-talent|expression of interest|enquir(?:y|ies)/i.test(
      title,
    )
  );
}
export function eligible(company: string, salary?: string) {
  return established.has(clean(company).toLowerCase()) || Boolean(salary && cash(salary));
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
export async function html(address: string, xml = false) {
  const origin = new URL(address).origin;
  let url = address;
  for (let n = 0; n < 5; n++) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(18000),
      cache: 'no-store',
      headers: { 'User-Agent': 'DesignJobs/1.0 (+https://github.com/madebyvishesh/design-jobs)' },
    });
    if (res.ok && !res.headers.get('cf-mitigated')) {
      const page = load(await res.text(), xml ? { xml: true } : undefined);
      if (/just a moment|attention required|access denied|checking your browser/i.test(page('title').text()))
        throw new Error('Publisher page unavailable');
      return page;
    }
    await res.body?.cancel();
    if (res.status === 404 || res.status === 410) return null;
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      const next = new URL(res.headers.get('location')!, url);
      if (
        next.origin !== origin &&
        !(
          next.protocol === 'https:' &&
          !next.port &&
          !next.username &&
          !next.password &&
          next.hostname.replace(/^www\./, '') === new URL(origin).hostname.replace(/^www\./, '')
        )
      )
        throw new Error('Changed publisher origin');
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
export function listing(ats: AtsSource, data: Entry): Job {
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
export async function details(
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
export async function indexPage(url: string) {
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
interface CreativeBoard {
  name: string;
  domain: string;
  index: string;
  marker: RegExp;
  links?: string;
  title?: string;
  location?: string;
}
const creativeBoards: CreativeBoard[] = [
  {
    name: 'Ragged Edge',
    domain: 'raggededge.com',
    index: 'https://raggededge.com/join',
    marker: /ready for something different/i,
    links: 'main a[href*="/join/"]',
  },
  {
    name: 'DixonBaxi',
    domain: 'dixonbaxi.com',
    index: 'https://joinus.dixonbaxi.com/jobs',
    marker: /jobs/i,
    links: 'a[href^="/jobs/"]',
    title: 'span:first-child',
    location: 'span:nth-child(2)',
  },
  {
    name: 'Tendril',
    domain: 'tendril.studio',
    index: 'https://tendril.studio/careers/',
    marker: /available positions/i,
    links: 'a.para[href^="/careers/"]',
    title: 'span:first-child',
    location: 'span:nth-child(2)',
  },
  {
    name: 'ManvsMachine',
    domain: 'mvsm.com',
    index: 'https://mvsm.com/jobs',
    marker: /jobs/i,
    links: '.js-job-link',
    title: 'h2',
    location: '.job--meta',
  },
  { name: 'BUCK', domain: 'buck.co', index: 'https://buck.co/careers', marker: /current vacancies/i },
  {
    name: 'FutureDeluxe',
    domain: 'futuredeluxe.com',
    index: 'https://futuredeluxe.com/info',
    marker: /vacancies/i,
  },
  {
    name: 'Giant Ant',
    domain: 'giantant.ca',
    index: 'https://www.giantant.ca/careers',
    marker: /current vacancies/i,
    links: 'main section a[href]',
  },
  {
    name: 'Instrument',
    domain: 'instrument.com',
    index: 'https://www.instrument.com/careers',
    marker: /find your next job/i,
    links: 'a:has(.jobs__list__item__title)',
    title: '.jobs__list__item__title',
    location: '.jobs__list__item__details__location',
  },
];
async function creativeBoard(board: CreativeBoard): Promise<BoardListings> {
  const $ = await indexPage(board.index);
  if (board.domain === 'buck.co') {
    const data = JSON.parse($('#__NEXT_DATA__').text());
    const modules = data.props?.pageProps?.page?.modules;
    const jobs = Array.isArray(modules) && modules.find((m) => Array.isArray(m.jobs))?.jobs;
    if (!Array.isArray(jobs)) throw new Error('Missing BUCK hiring feed');
    const candidates = jobs
      .filter((j) => role(j.title, board.domain))
      .map((j) => {
        if (new URL(j.absoluteUrl).origin !== 'https://buck.homerun.co')
          throw new Error('Changed BUCK application host');
        return { title: j.title, url: j.absoluteUrl, location: j.locationName };
      });
    return details(board.index, candidates, (c, page) => creativeDetails(board, c, page));
  }
  $('script,style,nav,footer,noscript').remove();
  if (!board.marker.test($('body').text())) throw new Error('Missing ' + board.name + ' hiring section');
  if (board.domain === 'futuredeluxe.com') {
    const jobs: Job[] = [];
    const rows = $('.toggle-wrapper').filter(
      (_, e) => $(e).closest('section').find('h2').first().text().trim() === 'Vacancies',
    );
    for (const e of rows.toArray()) {
      const [title, location] = clean($(e).find('.toggle-trigger').text()).split(/\s+[-–]\s+/);
      if (!role(title, board.domain)) continue;
      const address = $(e)
        .find('a[href*="airtable.com/"]')
        .filter((_, a) => /apply/i.test($(a).text()))
        .attr('href');
      if (
        !address ||
        new URL(address).origin !== 'https://airtable.com' ||
        !new URL(address).searchParams.get('subject')
      )
        throw new Error('Missing role-specific application');
      jobs.push(
        listing('employer', {
          company: board.name,
          companyDomain: board.domain,
          title,
          location,
          url: new URL(address).href,
        }),
      );
    }
    return { jobs, feed: board.index, indexed: rows.length };
  }
  const candidates: Candidate[] = [];
  $('.visually-hidden').remove();
  for (const e of $(board.links!).toArray()) {
    const a = $(e),
      title = clean(board.title ? a.find(board.title).text() : a.text());
    if (!role(title, board.domain)) continue;
    const url = new URL(a.attr('href')!, board.index);
    if (url.origin !== new URL(board.index).origin)
      throw new Error('Changed application host for ' + board.name);
    candidates.push({
      title,
      url: url.href,
      location: board.location ? clean(a.find(board.location).text()) : '',
    });
  }
  return details(board.index, candidates, (c, page) => creativeDetails(board, c, page));
}

export function creativeDetails(board: CreativeBoard, c: Candidate, $: CheerioAPI) {
  $('script,style,nav,footer,noscript').remove();
  const text = clean($('main').text() || $('body').text());
  if (
    /applications (?:are |have )?closed|job (?:has been filled|is closed)|no longer accepting applications/i.test(
      text,
    )
  )
    return null;
  if (!/apply|application/i.test(text)) throw new Error('Missing application instructions');
  const heading = $('h2,h3,h4,strong')
    .filter((_, e) => /^(?:salary|compensation):?$/i.test(clean($(e).text())))
    .first();
  const labeledPay = clean(heading.next().text());
  const excerpt =
    /(?:salary|compensation|rate for this position (?:will be|is))\s*[:–—-]?\s*((?:from\s+)?[$£€]\s*[\d.,]+[kK]?(?:\s*[-–]\s*[$£€]?\s*[\d.,]+[kK]?)?(?:\s*\/(?:hr|hour|year|day))?(?:\s+(?:USD|GBP|CAD|EUR))?)/i.exec(
      text,
    )?.[1];
  const salary = excerpt || (labeledPay.length <= 120 && cash(labeledPay) ? labeledPay : undefined);
  const [location, workplace] = (c.location || '').split(/\s+·\s+/);
  return listing('employer', {
    title: c.title,
    url: c.url,
    company: board.name,
    companyDomain: board.domain,
    location,
    workplace,
    salary,
    isRemote: /\bremote\b/i.test(c.location || ''),
    validThrough: dateLimit(text),
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
    const knownDomain = studioDomains.get(studioName(company));
    const employer = openEmployers.get(studioName(company)) || (knownDomain && [knownDomain, knownDomain]),
      salary = tags.find(cash);
    if (!employer || !role(title, employer[0]) || !eligible(company, salary)) continue;
    const address = $(e).attr('href') || '';
    if (!URL.canParse(address)) continue;
    const url = new URL(address);
    if (
      url.protocol !== 'https:' ||
      (url.host !== employer[1] && url.host.replace(/^www\./, '') !== employer[0]) ||
      url.username ||
      url.password
    )
      continue;
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
      throw new Error('Could not verify employer role');
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
    collectBoards(
      'employer',
      creativeBoards,
      (b) => ({ board: b.domain, domain: b.domain }),
      creativeBoard,
      report,
      4,
    ),
  ]);
  return groups.flat();
}
