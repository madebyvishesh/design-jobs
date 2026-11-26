import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrangementOf, employmentOf, locationNames, payBands } from '../lib/workFilters';
import { readBrowseParams, writeBrowseParams } from '../lib/browseParams';
import { browsePool, prepareListing } from '../lib/browseMatches';
import type { Job } from '../types/job';
const job = {
  id: 'sample',
  title: 'Staff Product Designer',
  company: 'Example',
  location: 'Bangalore, India',
  salary: 'USD 130,000–170,000 / year',
  isRemote: false,
  isAI: false,
  postedAt: '',
  department: 'Design',
  ats: 'ashby',
  workplace: 'Hybrid',
  employment: 'FullTime',
} as Job;
const ctx = {
  liveIds: new Set([job.id]),
  saved: new Set<string>(),
  hiddenIds: new Set<string>(),
  applied: new Set([job.id]),
  previousVisit: null,
  fetchedAt: 1,
  showHidden: false,
};
test('all new criteria round trip and legacy levels stay valid', () => {
  const c = readBrowseParams(
    new URLSearchParams(
      'work=hybrid&type=full&city=Bengaluru&level=staff,senior,invalid&target=150000&period=month&currency=CAD&hideApplied=1',
    ),
  );
  assert.equal(c.level, 'senior,staff');
  const p = new URLSearchParams('ref=x');
  writeBrowseParams(p, c);
  assert.deepEqual(readBrowseParams(p), c);
  assert.equal(p.get('ref'), 'x');
  assert.equal(readBrowseParams(new URLSearchParams('level=senior')).level, 'senior');
  assert.equal(readBrowseParams(new URLSearchParams('target=-4&work=constructor')).target, '');
});
test('salary targets match only explicit periods and currencies, at the upper bound', () => {
  assert.deepEqual(payBands(job.salary), [{ currency: 'USD', period: 'year', max: 170000 }]);
  assert.deepEqual(payBands('Base Pay Range (Annual) · $89,300–$122,760 USD'), [
    { currency: 'USD', period: 'year', max: 122760 },
  ]);
  assert.deepEqual(payBands('NYC Base Salary · $139,061–$203,957 CAD / $40–$55 USD'), []);
  assert.deepEqual(payBands('$100K - $150K'), []);
  const row = [prepareListing(job)];
  for (const [q, n] of [
    ['work=hybrid&type=full&city=Bengaluru&level=senior,staff&target=170000', 1],
    ['target=170001', 0],
    ['target=50000&currency=CAD', 0],
    ['target=10&period=hour', 0],
    ['hideApplied=1', 0],
  ] as const)
    assert.equal(browsePool(row, readBrowseParams(new URLSearchParams(q)), ctx).length, n, q);
});
test('legacy records preserve unknowns and distinguish remote eligibility from office locations', () => {
  assert.equal(arrangementOf({ ...job, workplace: undefined }), 'unknown');
  assert.deepEqual(employmentOf({ ...job, employment: undefined }), ['unknown']);
  assert.deepEqual(employmentOf({ ...job, employment: 'PART_TIME, CONTRACTOR' }), ['part', 'contract']);
  assert.deepEqual(locationNames({ ...job, location: 'Bangalore, India · Remote (US)' }), [
    'Bengaluru',
    'India',
  ]);
  assert.equal(arrangementOf({ ...job, isRemote: true, workplace: 'Hybrid' }), 'hybrid');
});
