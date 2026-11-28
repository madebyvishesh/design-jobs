import test from 'node:test';
import assert from 'node:assert/strict';
import { greenhouseSalary } from '../lib/jobPay';
import { payBands } from '../lib/workFilters';
import { isDesignRole } from '../lib/filterJobs';
import { jobFields } from '../lib/jobFields';
import { fetchStudioJobs } from '../lib/fetchers/studios';
import { hasCompletedJobBoard, type BoardReport } from '../lib/boardFetch';

test('studio refresh excludes expired roles, preserves pay and uses only enabled publishers', async (t) => {
  const porto = 'https://www.portorocha.com/about';
  const pages = new Map<string, string>([
    [
      'https://www.pentagram.com/careers',
      '<h3 id="rolesHeading">Open Positions</h3><ul aria-labelledby="rolesHeading"></ul>',
    ],
    ['https://koto.com/careers', '<h2>Open roles</h2>'],
    [
      porto,
      '<div class="about__openings"><a href="/about/openings/old">Senior Motion Designer</a><a href="/about/openings/future">Future Opportunities</a></div>',
    ],
    [
      'https://www.portorocha.com/about/openings/old',
      '<h2>How to Apply</h2><p>Apply by March 20th, 2020.</p>',
    ],
    [
      'https://openrol.es/',
      '<a data-framer-name="Desktop" href="https://www.newgenre.studio/join/designer"><img alt="Job listing profile photo"><p>Designer</p><p>New Genre</p><p>London</p><p>Full-Time</p><p>£36,000 – £48,000</p></a>',
    ],
    ['https://www.newgenre.studio/join/designer', '<main>Designer. Apply today.</main>'],
  ]);
  pages.set('https://www.basedesign.com/jobs', '<h1>Work with us</h1>');
  for (const [slug, name] of [
    ['jones-knowles-ritchie', 'Jones Knowles Ritchie'],
    ['nexusstudios', 'Nexus Studios'],
    ['wearebulletproof', 'Bulletproof'],
    ['wolff-olins', 'Wolff Olins'],
    ['moving-brands', 'Moving Brands'],
    ['designstudio', 'DesignStudio'],
    ['ustwo', 'ustwo'],
  ]) {
    pages.set(
      'https://www.workable.com/api/accounts/' + slug + '?details=true',
      JSON.stringify({
        name,
        jobs:
          slug === 'jones-knowles-ritchie'
            ? [
                {
                  title: 'Digital Designer',
                  url: 'https://apply.workable.com/j/example',
                  locations: [{ city: 'London' }],
                },
              ]
            : [],
      }),
    );
  }
  for (const [url, body] of [
    ['https://raggededge.com/join', 'Ready for something different?'],
    ['https://joinus.dixonbaxi.com/jobs', 'Jobs'],
    ['https://tendril.studio/careers/', 'Available Positions'],
    [
      'https://mvsm.com/jobs',
      'Jobs <a class="js-job-link" href="/jobs/super-talent"><h2>Super-Talent</h2></a>',
    ],
    ['https://futuredeluxe.com/info', 'Vacancies'],
    ['https://www.giantant.ca/careers', 'current vacancies'],
    ['https://www.instrument.com/careers', 'Find Your Next Job'],
    [
      'https://buck.co/careers',
      '<script id="__NEXT_DATA__">' +
        JSON.stringify({
          props: {
            pageProps: {
              page: {
                modules: [
                  {
                    jobs: [
                      {
                        title: '2D Animation Apprentice',
                        absoluteUrl: 'https://buck.homerun.co/animation',
                        locationName: 'New York',
                      },
                    ],
                  },
                ],
              },
            },
          },
        }) +
        '</script>',
    ],
    [
      'https://buck.homerun.co/animation',
      '<main>2D Animation Apprentice. Compensation: $22.60/hr USD. Apply now.</main>',
    ],
  ])
    pages.set(url, body);
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/unavailable')) return new Response(null, { status: 503 });
    assert.ok(pages.has(url), url);
    return new Response(pages.get(url));
  });
  const report: BoardReport[] = [];
  const jobs = await fetchStudioJobs(report);
  assert.deepEqual(jobs.map((job) => job.company).sort(), ['BUCK', 'Jones Knowles Ritchie', 'New Genre']);
  assert.ok(
    report.every((b) => b.status === 'ok'),
    JSON.stringify(report),
  );
  assert.equal(jobs.find((job) => job.company === 'BUCK')?.salary, '$22.60/hr USD');
  assert.deepEqual(jobs.find((job) => job.company === 'New Genre')?.sources, ['openroles']);
  assert.ok(!report.some((b) => b.domain === 'the-brandidentity.com'));
  assert.equal(report.find((board) => board.domain === 'portorocha.com')?.received, 0);
});

test('motion studio roles survive classification, field selection and hourly pay filtering', () => {
  assert.equal(isDesignRole('2D/3D Designer', 'Creative', 'brandnewschool.com'), true);
  assert.equal(isDesignRole('3D Designer', 'Engineering', 'other.com'), false);
  assert.equal(isDesignRole('Director', 'Operations', 'other.com'), false);
  assert.ok(jobFields('Sr. Artist', '', 'tendril.studio').includes('motion'));
  assert.deepEqual(payBands('$22.60/hr USD'), [{ currency: 'USD', period: 'hour', max: 22.6 }]);
});

test('a studio salary range in Greenhouse body copy is visible without guessing a currency or period', () => {
  assert.equal(
    greenhouseSalary('&lt;h3&gt;Salary Range&lt;/h3&gt;&lt;p&gt;$70,000 - $90,000&lt;/p&gt;'),
    '$70,000 - $90,000',
  );
  assert.equal(
    greenhouseSalary('Benefits: $100 - $200 wellness reimbursement. Salary is competitive.'),
    undefined,
  );
});

test('studio discovery follows official sitemap vacancies and rejects a portfolio invitation', async (t) => {
  const { discoverStudio } = await import('../lib/fetchers/studioDiscovery');
  const home = 'https://sample.studio/';
  const pages = new Map([
    [home, '<main>Independent design studio</main>'],
    [home + 'sitemap.xml', '<urlset><url><loc>' + home + 'jobs</loc></url></urlset>'],
    [
      home + 'jobs',
      '<a href="/jobs/brand-designer">Brand Designer</a><a href="/jobs/register">General Application</a>',
    ],
    [home + 'jobs/register', '<h1>General Application</h1>'],
    [
      home + 'jobs/brand-designer',
      '<main><h1>Brand Designer</h1><p>Salary — £45k-60k</p>Apply today.</main>',
    ],
  ]);
  t.mock.method(
    globalThis,
    'fetch',
    async (input: RequestInfo | URL) =>
      new Response(pages.get(String(input)), { status: pages.has(String(input)) ? 200 : 404 }),
  );
  const report = await discoverStudio(['sample.studio', 'Sample Studio']);
  assert.deepEqual(
    report.jobs.map((j) => [j.title, j.salary]),
    [['Brand Designer', '£45k-60k']],
  );
});

test('a successful directory read alone cannot replace the published job snapshot', () => {
  const board: BoardReport = {
    board: 'directory',
    domain: 'example.com',
    source: 'employer',
    status: 'ok',
    received: 0,
    directory: true,
  };
  assert.equal(hasCompletedJobBoard([board]), false);
  assert.equal(hasCompletedJobBoard([board, { ...board, directory: false }]), true);
});
