import test from 'node:test';
import assert from 'node:assert/strict';
import { payBands } from '../lib/workFilters';
import { isDesignRole } from '../lib/filterJobs';
import { jobFields } from '../lib/jobFields';
import { fetchStudioJobs } from '../lib/fetchers/studios';
import type { BoardReport } from '../lib/boardFetch';

test('studio refresh distinguishes expired, undisclosed, paid, missing and temporarily unreadable openings', async (t) => {
  const tbi = 'https://the-brandidentity.com/jobs';
  const porto = 'https://www.portorocha.com/about';
  const portalRows = [
    ['known', 'Feels Like', 'Undisclosed'],
    ['unknown', 'Small Studio', 'Undisclosed'],
    ['paid', 'New Genre', '£36,000 – £48,000/year'],
    ['expired', 'Small Studio', '$80,000/year'],
    ['unavailable', 'Unavailable Studio', '$70/hour'],
  ];
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
      tbi,
      '<main>All roles ' +
        portalRows.map(([key]) => '<a href="/jobs/roles/' + key + '">Designer</a>').join('') +
        '</main>',
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
  for (const [key, name, pay] of portalRows.slice(0, -1)) {
    const data = {
      '@type': 'JobPosting',
      title: 'Designer',
      hiringOrganization: { name, sameAs: key === 'paid' ? 'https://newgenre.studio' : undefined },
      datePosted: '2026-11-10',
      validThrough: key === 'expired' ? '2020-01-01' : undefined,
    };
    pages.set(
      tbi + '/roles/' + key,
      '<script type="application/ld+json">' +
        JSON.stringify(data) +
        '</script><dl><dt>Salary</dt><dd>' +
        pay +
        '</dd><dt>Location</dt><dd>London, UK</dd></dl>',
    );
  }
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/unavailable')) return new Response(null, { status: 503 });
    assert.ok(pages.has(url), url);
    return new Response(pages.get(url));
  });
  const report: BoardReport[] = [];
  const jobs = await fetchStudioJobs(report);
  assert.deepEqual(jobs.map((job) => job.company).sort(), [
    'BUCK',
    'Feels Like',
    'Jones Knowles Ritchie',
    'New Genre',
  ]);
  assert.ok(
    report.every((b) => b.status === (b.source === 'tbi' ? 'partial' : 'ok')),
    JSON.stringify(report),
  );
  assert.equal(jobs.find((job) => job.company === 'BUCK')?.salary, '$22.60/hr USD');
  assert.equal(jobs.find((job) => job.company === 'Feels Like')?.salary, undefined);
  assert.deepEqual(jobs.find((job) => job.company === 'New Genre')?.sources, ['tbi', 'openroles']);
  assert.deepEqual(report.find((board) => board.source === 'tbi')?.unverifiedUrls, [
    tbi + '/roles/unavailable',
  ]);
  assert.equal(report.find((board) => board.domain === 'portorocha.com')?.received, 0);
});

test('motion studio roles survive classification, field selection and hourly pay filtering', () => {
  assert.equal(isDesignRole('2D/3D Designer', 'Creative', 'brandnewschool.com'), true);
  assert.equal(isDesignRole('3D Designer', 'Engineering', 'other.com'), false);
  assert.equal(isDesignRole('Director', 'Operations', 'other.com'), false);
  assert.ok(jobFields('Sr. Artist', '', 'tendril.studio').includes('motion'));
  assert.deepEqual(payBands('$22.60/hr USD'), [{ currency: 'USD', period: 'hour', max: 22.6 }]);
});
