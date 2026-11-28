import type { CheerioAPI } from 'cheerio';
import type { BoardListings } from '../boardFetch';
import { creativeDetails, details, eligible, html, indexPage, listing, role } from './studios';
import type { Job } from '../../types/job';

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
const passionFeeds = [
  ['2886', 'Passion Pictures'],
  ['2927', 'Passion Planet'],
  ['5200', 'Passion Documentaries'],
];

async function passionBoard(): Promise<BoardListings> {
  const feed = 'https://www.passion-animation.com/join-us/';
  const parts = await Promise.allSettled(
    passionFeeds.map(async ([id, company]) => {
      const url = 'https://www.thetalentmanager.com/tv-companies/' + id + '/jobs/rss';
      const $ = await html(url, true);
      if (!$ || clean($('rss > channel > title').text()).toLowerCase() !== company.toLowerCase() + ' jobs')
        throw new Error('Unverified employer RSS feed');
      const items = $('channel > item');
      const jobs: Job[] = [];
      for (const item of items.toArray()) {
        const value = (field: string) => clean($(item).children(field).text());
        const title = value('title'),
          salary = value('salary'),
          address = value('link');
        if (!role(title) || !eligible('Passion Pictures', salary)) continue;
        if (!address.startsWith('https://www.thetalentmanager.com/jobs/'))
          throw new Error('Unrecognized job link');
        const deadline = value('application_end');
        const validThrough = /^\d{4}-\d\d-\d\d$/.test(deadline) ? deadline + 'T23:59:59.999Z' : undefined;
        if (validThrough && Date.parse(validThrough) < Date.now()) continue;
        const pub = Date.parse(value('pubDate'));
        jobs.push(
          listing('employer', {
            title,
            company,
            companyDomain: 'passion-pictures.com',
            url: address,
            location: value('location'),
            salary: salary || undefined,
            validThrough,
            postedAt: Number.isFinite(pub) ? new Date(pub).toISOString() : '',
          }),
        );
      }
      return { jobs, indexed: items.length };
    }),
  );
  const jobs: Job[] = [];
  let indexed = 0;
  const unreadable: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.status === 'fulfilled') {
      jobs.push(...part.value.jobs);
      indexed += part.value.indexed;
    } else unreadable.push(passionFeeds[i][1]);
  }
  if (unreadable.length === parts.length) throw new Error('Could not verify any Passion division RSS feed');
  return {
    jobs,
    indexed,
    feed,
    ...(unreadable.length ? { incomplete: 'Unavailable RSS feed: ' + unreadable.join(', ') } : {}),
  };
}

function listedRoles($: CheerioAPI, index: string, domain: string, name: string) {
  const scholar = domain === 'helloscholar.com';
  const field = domain === 'field.io';
  const selector = scholar
    ? 'a[href^="/jobs/"]:has(.title)'
    : field
      ? 'a[href^="/jobs/"]'
      : 'a:has(.ATS-position-title)';
  const links = $(selector);
  const body = clean($('body').text());
  const marker = scholar ? /opportunities/i : field ? /open positions/i : /locomotive/i;
  if (!marker.test(body + ' ' + $('title').text())) throw new Error('Unrecognized studio jobs page');
  if (!scholar && !field && !links.length && !/no (?:current |open )?(?:jobs|positions|openings)/i.test(body))
    throw new Error('Unverified Collage positions list');
  const candidates = links.toArray().flatMap((e) => {
    const link = $(e),
      url = new URL(link.attr('href')!, index);
    if (
      url.origin !== new URL(index).origin ||
      (!scholar && !field && !/^\/jobs\/locomotive\/\d+$/.test(url.pathname))
    )
      throw new Error('Unexpected employer job URL');
    const title = clean(
      (scholar
        ? link.find('.title')
        : field
          ? link.children().first()
          : link.find('.ATS-position-title')
      ).text(),
    );
    if (!title) throw new Error('Missing advertised title');
    if (!role(title, domain) && !(scholar && title === 'Intern')) return [];
    const meta = link.find('.ATS-commitment-and-location').clone();
    meta.find('.ATS-bullet-point').replaceWith(' · ');
    const location = scholar
      ? link.find('.location').text()
      : field
        ? link.children().last().text()
        : meta.text().split(' · ')[1] || '';
    return [{ title, url: url.href, location: clean(location) }];
  });
  return details(index, candidates, (c, page) => {
    const header = clean(page('h1').text());
    if (header.toLowerCase() !== c.title.toLowerCase()) throw new Error('Role title changed');
    if (
      domain === 'locomotive.ca' &&
      !page('a[href]')
        .toArray()
        .some((e) => page(e).attr('href') === new URL(c.url).pathname + '/apply')
    )
      throw new Error('Missing Collage application link');
    if (
      scholar &&
      c.title === 'Intern' &&
      !/illustration, design, 2d animation/i.test(clean(page('body').text()))
    )
      return null;
    const job = creativeDetails({ domain, name, index, marker }, c, page);
    if (!job) return null;
    if (scholar && c.title === 'Intern') job.department = 'Design & Animation';
    return eligible(name, job.salary) ? job : null;
  }).then((result) => ({ ...result, indexed: links.length }));
}

export async function reviewedStudioBoard(
  domain: string,
  name: string,
  index: string,
): Promise<BoardListings | undefined> {
  if (domain === 'passion-pictures.com') return passionBoard();
  if (
    !['helloscholar.com', 'field.io', 'locomotive.ca', 'found-studio.com', 'builders-club.com'].includes(
      domain,
    )
  )
    return;
  const $ = await indexPage(index);
  $('script,style,nav,footer,noscript,svg').remove();
  if (domain === 'helloscholar.com' || domain === 'field.io' || domain === 'locomotive.ca')
    return listedRoles($, index, domain, domain === 'helloscholar.com' ? 'Scholar' : name);
  const found = domain === 'found-studio.com';
  if (!(found ? /open roles and new opportunities/i : /join the team/i).test(clean($('body').text())))
    throw new Error('Missing studio openings section');
  const jobs: Job[] = [];
  const rows = found
    ? $('.contact__roles article')
    : $('[class*="columnTextLarge"]')
        .filter((_, e) => /^join the team$/i.test(clean($(e).children('p').first().text())))
        .parent()
        .next()
        .find('p')
        .filter((_, e) => !$(e).children().length && $(e).next('p').find('strong').length > 0);
  for (const row of rows.toArray()) {
    const title = clean(found ? $(row).find('h3').text() : $(row).text());
    if (!role(title, domain)) continue;
    const apply = found
      ? $(row).find('a[href^="mailto:jobs@found-studio.com"]')
      : $('a[href^="https://airtable.com/"]').filter((_, e) => /job application form/i.test($(e).text()));
    if (!apply.length) throw new Error('Role-specific application instructions unavailable');
    const sourceLink = found
      ? $(row).find('a[href^="https://docs.google.com/document/"]').attr('href')
      : undefined;
    if (found && sourceLink) {
      const href = new URL(sourceLink);
      if (
        href.origin !== 'https://docs.google.com' ||
        !/^\/document\/d\/e\/[a-zA-Z0-9_-]+\/pub$/.test(href.pathname)
      )
        throw new Error('Unverified studio role brief');
      const page = await indexPage(href.href);
      const advertised = clean(
        page('p')
          .filter((_, p) => /^Job Advert/i.test(clean(page(p).text())))
          .first()
          .text(),
      ).replace(/^Job Advert\s*/i, '');
      if (!role(advertised, domain)) throw new Error('Unverified job title in Found brief');
      const location = /join our team in London/i.test(page('body').text()) ? 'London' : '';
      const job = creativeDetails(
        { domain, name, index, marker: /./ },
        { title: advertised, url: href.href, location },
        page,
      );
      if (job && eligible(name, job.salary)) jobs.push(job);
      continue;
    }
    if (!eligible(name)) continue;
    const job = listing('employer', {
      company: name,
      companyDomain: domain,
      title,
      url: sourceLink || index + '#' + encodeURIComponent(title),
    });
    jobs.push({ ...job, url: sourceLink || index });
  }
  if (
    !rows.length &&
    !/no (?:open roles|openings|open positions)|not (?:currently )?hiring/i.test(clean($('body').text()))
  )
    throw new Error('Could not verify the advertised roles');
  return { feed: index, indexed: rows.length, jobs };
}
