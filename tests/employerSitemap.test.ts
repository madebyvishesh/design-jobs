import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPosting, sitemapLinks } from '../lib/fetchers/employerSitemap';

const feed = new URL('https://careers.example.com/sitemap.xml');
const link = new URL('/job/product-designer', feed);
const company = { tenant: 'example', dc: 'wd5', site: 'Careers', name: 'Example', domain: 'example.com' };

test('reads index children and text feeds and rejects broken or off-site indexes', () => {
  const index = '<sitemapindex><sitemap><loc>https://careers.example.com/page.xml?a=1&amp;b=2</loc></sitemap></sitemapindex>';
  assert.equal(sitemapLinks(index, feed).links[0].search, '?a=1&b=2');
  assert.equal(sitemapLinks(index, feed).index, true);
  assert.deepEqual(sitemapLinks(link.href, new URL('/sitemap.txt', feed)).links, [link]);
  assert.throws(() => sitemapLinks('<urlset><url><loc>partial', feed));
  assert.throws(() => sitemapLinks(index.replace('careers.example.com', 'elsewhere.example'), feed));
});

test('reads exact titles, stable IDs, destinations and remote restrictions from structured data', () => {
  const posting = { '@type': 'JobPosting', title: 'Senior Product Designer', identifier: { value: 'R123' },
    datePosted: '2026-11-20', jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { name: 'Germany' } };
  const page = (data: unknown) => '<script type="application/ld+json">' + JSON.stringify({ '@graph': [data] }) + '</script>';
  const job = readPosting(page(posting), link, company)!;
  assert.deepEqual([job.id, job.title, job.location, job.isRemote, job.url, job.ats],
    ['workday-example-R123', posting.title, 'Germany', true, link.href, 'employer']);
  assert.equal(readPosting(page(posting) + '<a href="https://example.wd5.myworkdayjobs.com/Careers/job/A/R123">Apply</a>', link, company)?.ats, 'workday');
  assert.equal(readPosting(page({ ...posting, validThrough: '2020-01-01' }), link, company), undefined);
  assert.equal(readPosting('This position has been filled.', link, company), undefined);
  assert.throws(() => readPosting('<html>Service unavailable</html>', link, company));
});
