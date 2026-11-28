import type { CheerioAPI } from 'cheerio';
import { collectBoards, type BoardListings, type BoardReport } from '../boardFetch';
import { directoryPages, directoryStudios, studioName } from './studioDirectory';
import { creativeDetails, details, eligible, html, indexPage, listing, role } from './studios';
import type { Job } from '../../types/job';

const dedicated = new Set([
  'pentagram.com',
  'portorocha.com',
  'raggededge.com',
  'interbrand.com',
  'dixonbaxi.com',
  'wolffolins.com',
  'wearebulletproof.com',
  'buck.co',
  'futuredeluxe.com',
  'giantant.ca',
  'mvsm.com',
  'tendril.studio',
  'brandnewschool.com',
  'nexusstudios.com',
]);
const starts: Record<string, string> = {
  'artandgraft.com': 'https://artandgraft.com/contact/jobs',
  'hellohornet.com': 'https://www.hellohornet.com/careers',
  'studiodumbar.com': 'https://studiodumbar.com/jobs',
  'territorystudio.com': 'https://territorystudio.teamtailor.com/jobs',
  'frame.dk': 'https://frame.dk/careers/',
  'goldenwolf.tv': 'https://www.goldenwolf.tv/careers',
  'notreal.tv': 'https://notreal.tv/jobs',
  'wonderkindco.co': 'https://wonderkindco.co/careers',
  'passion-pictures.com': 'https://www.passion-animation.com/join-us/',
  'ordinaryfolk.co': 'https://www.ordinaryfolk.co/contact',
  'found-studio.com': 'https://www.found-studio.com/contact/',
  'andwalsh.com': 'https://andwalsh.com/info/',
  'gentleman-scholar.com': 'https://helloscholar.com/',
  'psyop.com': 'https://www.psyop.com/contact/',
  'field.io': 'https://field-io.notion.site/Careers-at-FIELD-IO-affb12ae22e144a881e221dddb71241c',
};
const trim = (s: string) => s.replace(/\s+/g, ' ').trim();
const hiring =
  /(?:\b(?:jobs?|careers?|vacancies|open positions|open roles|join our team|we.re hiring)\b|\/join(?:-us)?(?:\/|$))/i;
const contact = /^(?:studio|info|about(?: us)?|contact(?: us)?|join us)$/i;
function siteLinks($: CheerioAPI, current: string, domain: string) {
  const allowed = new Set([domain, new URL(current).hostname.replace(/^www\./, '')]);
  return $('a[href]')
    .toArray()
    .flatMap((e) => {
      const href = $(e).attr('href')!;
      if (!href || /^[#?]/.test(href) || !URL.canParse(href, current)) return [];
      const url = new URL(href, current);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        !allowed.has(url.hostname.replace(/^www\./, ''))
      )
        return [];
      const title = trim($(e).text());
      return [{ title, url: url.href, pathname: url.pathname }];
    });
}
const jobRoute = /(?:^|\/)(?:jobs?|careers?|vacancies|opportunities|join(?:-us)?)(?:\/|$)/i;
async function sitemapHiringPages(start: string) {
  const origin = new URL(start).origin;
  const found = new Set<string>();
  const urls = [origin + '/sitemap.xml'];
  for (let i = 0; i < urls.length && i < 4; i++) {
    const page = await html(urls[i]);
    if (!page) continue;
    for (const e of page('loc').toArray()) {
      const address = trim(page(e).text());
      if (!URL.canParse(address)) continue;
      const url = new URL(address);
      if (url.origin !== origin || url.username || url.password) continue;
      if (jobRoute.test(url.pathname)) found.add(url.href);
      else if (
        i === 0 &&
        /(?:page|job|career|post|index|sitemap[-_]?0).*\.xml$/i.test(url.pathname) &&
        !urls.includes(url.href)
      )
        urls.push(url.href);
    }
  }
  return Array.from(found);
}
function specialListings(domain: string, name: string, index: string, $: CheerioAPI): Job[] | undefined {
  if (domain === 'studiodumbar.com') {
    const section = $('p')
      .filter((_, e) => /^Available internships:/i.test(trim($(e).text())))
      .first()
      .clone();
    if (!section.length && !/working at studio dumbar/i.test($('body').text()))
      throw new Error('Unrecognized careers page');
    if (!$('a[href^="mailto:interns@studiodumbar.com"]').length) return [];
    section.find('br').replaceWith('\n');
    return section
      .text()
      .split('\n')
      .slice(1)
      .map(trim)
      .filter((d) => /^(?:visual|motion|sound) design$|^creative coding$/i.test(d))
      .map((d) => {
        const title = d + ' Intern';
        const job = listing('employer', {
          company: name,
          companyDomain: domain,
          title,
          url: index + '#' + encodeURIComponent(d),
          employment: 'Internship',
        });
        return { ...job, url: index };
      });
  }
  if (domain === 'hellohornet.com') {
    if (!/join the team|general opportunities|no open positions/i.test($('body').text()))
      throw new Error('Unrecognized careers page');
    return $('.careers_collection-item')
      .toArray()
      .flatMap((e) => {
        const title = trim($(e).find('p.paragraph-text-lg').first().text());
        const url = $(e).find('a[href^="https://airtable.com/"]').first().attr('href');
        if (!url || !role(title, domain)) return [];
        const meta = $(e).find('.career11_job-details-wrapper').first().text();
        const [location, employment] = meta.split('·').map(trim);
        return [
          listing('employer', {
            title,
            company: name,
            companyDomain: domain,
            url,
            location,
            employment,
            isRemote: /remote/i.test(location),
          }),
        ];
      });
  }
}
export async function discoverStudio([domain, name]: [string, string]): Promise<BoardListings> {
  const start = starts[domain] || 'https://' + domain + '/';
  const visited = new Set<string>(),
    candidates = new Map<string, { title: string; url: string }>();
  const queue = [start];
  let careers = Boolean(starts[domain]) && jobRoute.test(new URL(start).pathname),
    truncated = false;
  let checkedSitemap = false;
  while (queue.length) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    if (visited.size >= 7) {
      truncated = true;
      break;
    }
    visited.add(url);
    const $ = await indexPage(url);
    $('script,style,svg,noscript').remove();
    const bodyText = trim($('body').text());
    if (domain === 'wonderkindco.co' && /positions are posted there/i.test(bodyText))
      throw new Error('Employer advertises openings only on Instagram');
    if (domain === 'field.io' && /JavaScript|enable javascript/i.test(bodyText) && !$('main h1').length)
      throw new Error('Notion hiring page requires client rendering');
    if (/^(?:404|page not found)$/i.test(bodyText)) throw new Error('Employer page not found');
    if (
      domain === 'passion-pictures.com' &&
      /advertise our production vacancies on this site/i.test(bodyText) &&
      !$('a[href*="thetalentmanager.com"]').filter((_, e) => !$(e).attr('href')?.startsWith('mailto:')).length
    )
      throw new Error('Employer directs applicants to The Talent Manager');
    const headline = trim($('h1').first().text());
    if (
      jobRoute.test(new URL(url).pathname) &&
      role(headline, domain) &&
      headline.length < 110 &&
      !/^jobs? at /i.test(headline)
    ) {
      candidates.set(url, { title: headline, url });
      careers = true;
    }
    const special = specialListings(domain, name, url, $);
    if (special) return { jobs: special, feed: url, indexed: special.length };
    const links = siteLinks($, url, domain);
    for (const link of links) {
      if (link.url.replace(/\/$/, '') === url.replace(/\/$/, '') || !link.title) continue;
      const jobPath = jobRoute.test(link.pathname);
      const onBoard =
        hiring.test(new URL(url).pathname) || (url === starts[domain] && !/contact\/?$/.test(url));
      if ((jobPath || onBoard) && role(link.title, domain) && link.title.length < 130) {
        candidates.set(link.url, { title: link.title, url: link.url });
      } else if (
        (hiring.test(link.title) || jobPath) &&
        (link.title.length < 42 || jobPath) &&
        !role(link.title, domain)
      ) {
        careers = true;
        if (!visited.has(link.url) && !queue.includes(link.url)) queue.push(link.url);
      }
    }
    if (!careers && url === start) {
      queue.push(
        ...links
          .filter((link) => contact.test(link.title))
          .slice(0, 2)
          .map((link) => link.url),
      );
    }
    if (!queue.length && !careers && !checkedSitemap) {
      checkedSitemap = true;
      const discovered = await sitemapHiringPages(start);
      for (const href of discovered) if (!visited.has(href)) queue.push(href);
      if (discovered.length) careers = true;
    }
  }
  const result = await details(start, Array.from(candidates.values()), (c, page) => {
    const headings = page('h1,h2,h3,title')
      .toArray()
      .map((e) => trim(page(e).text()).toLowerCase());
    if (!headings.some((h) => h.includes(c.title.toLowerCase()))) throw new Error('Role title unverified');
    const job = creativeDetails({ domain, name, index: start, marker: /./ }, c, page);
    return job && eligible(name, job.salary) ? job : null;
  });
  if (!result.incomplete && (!careers || truncated)) {
    result.incomplete = truncated
      ? 'Career index still contains unverified links'
      : 'No public vacancy index identified';
    delete result.unverifiedUrls;
  }
  return result;
}
export async function fetchDirectoryStudios(report: BoardReport[]) {
  const catalog = new Map(Object.entries(directoryStudios).map(([name, domain]) => [domain, name]));
  const directoryReport: BoardReport[] = [];
  await collectBoards(
    'employer',
    directoryPages,
    (p) => ({ board: new URL(p.url).hostname, domain: new URL(p.url).hostname }),
    async (p) => {
      const $ = await indexPage(p.url);
      const names =
        p.name === 'Motionimo'
          ? $('a.group.block h3')
              .map((_, e) => trim($(e).text()))
              .get()
          : $('h2,h3')
              .filter((_, e) => /^\d{1,2}\.\s/.test(trim($(e).text())))
              .map((_, e) => trim($(e).find('a').first().text()))
              .get()
              .filter(Boolean);
      if (!names.length) throw new Error('No studio entries found');
      const known = new Set(Object.keys(directoryStudios).map(studioName));
      const unknown = names.filter((n) => !known.has(studioName(n)));
      return {
        jobs: [],
        feed: p.url,
        indexed: names.length,
        ...(unknown.length ? { incomplete: 'Unverified new studio names: ' + unknown.join(', ') } : {}),
      };
    },
    directoryReport,
    2,
  );
  report.push(...directoryReport.map((board) => ({ ...board, directory: true })));
  return collectBoards(
    'employer',
    Array.from(catalog).filter(([domain]) => !dedicated.has(domain)),
    ([domain]) => ({ board: domain, domain }),
    discoverStudio,
    report,
    8,
  );
}
