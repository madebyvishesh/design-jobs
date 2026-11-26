import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobFields } from '../lib/jobFields';
import { withFirstSeen } from '../lib/firstSeen';
import { indexJob, titleRelevance, searchTerms } from '../lib/jobSearch';
import { remoteLocation } from '../lib/remoteLocation';
import { salaryRange, greenhouseSalary } from '../lib/jobPay';
import { isDesignRole } from '../lib/filterJobs';
import { readBrowseParams, writeBrowseParams } from '../lib/browseParams';
import type { Job } from '../types/job';

test('disciplines can overlap while adjacent software roles are excluded', () => {
  assert.deepEqual(jobFields('Senior Product Designer, Design Systems'), ['product', 'systems']);
  assert.deepEqual(jobFields('Senior UX Researcher'), ['research']);
  assert.deepEqual(jobFields('UX Writer'), ['content']);
  assert.ok(jobFields('Principal Game Designer').includes('games'));
  assert.ok(!jobFields('Design Systems Designer').includes('games'));
  assert.equal(isDesignRole('Software Engineering Manager, Engine UI'), false);
  assert.equal(isDesignRole('Software Engineer, Design Systems'), true);
});
test('new arrivals keep their original observation across edits and absences', () => {
  const entry = (id: string) => ({ id, title: id } as Job);
  const snapshot = (time: number, ...ids: string[]) => ({ fetchedAt: time, allJobs: ids.map(entry), aiJobs: [] });
  const first = withFirstSeen(snapshot(20, 'old','new'), snapshot(10, 'old'));
  assert.deepEqual(first.allJobs.map(j => j.firstSeenAt), [10,20]);
  const next = withFirstSeen(snapshot(30, 'new'), first);
  assert.equal(withFirstSeen(snapshot(40, 'old'), next).allJobs[0].firstSeenAt, 10);
});
test('exact title and explicit sort and field choices survive query round trips', () => {
  const score = (title: string) => titleRelevance(indexJob({ title, location: '', company: 'Product Design' } as Job), searchTerms('product designer'));
  assert.ok(score('Product Designer') > score('Senior Product Designer'));
  assert.ok(score('Senior Product Designer') > score('Graphic Designer'));
  const index = indexJob({ title: 'Senior Product Designer', company: 'X', location: '' } as Job);
  assert.equal(titleRelevance(index, searchTerms('designer remote product')), titleRelevance(index, searchTerms('remote product designer')));
  assert.equal(titleRelevance(index, searchTerms('remote product desginer'), true), titleRelevance(index, searchTerms('product designer')));
  const p = new URLSearchParams('field=motion&sort=postedAt-&new=1');
  const state = readBrowseParams(p);
  writeBrowseParams(p,state);
  assert.equal(state.field,'motion'); assert.equal(p.get('sort'),'postedAt-'); assert.equal(p.get('new'),'1');
  assert.equal(readBrowseParams(new URLSearchParams('field=constructor')).field, 'all');
});
test('display only supplied salary and remote geography', () => {
  assert.equal(remoteLocation('San Francisco / Remote (US, Canada)'), 'US, Canada');
  assert.equal(remoteLocation('Canada - Remote'), 'Canada');
  assert.equal(remoteLocation('Texas only – Remote'), 'Texas only');
  assert.equal(remoteLocation('United States - Remote (Pacific hours)'), 'United States - Remote (Pacific hours)');
  assert.equal(remoteLocation('Remote'), '');
  assert.equal(remoteLocation('San Francisco / Remote'), '');
  assert.equal(remoteLocation('Remote - US only'), 'US only');
  assert.equal(remoteLocation('Remote (Anywhere in the world)'), 'Worldwide');
  assert.equal(salaryRange(45000,68000,'EUR','1 YEAR'), 'EUR 45,000–68,000 / year');
  assert.equal(salaryRange(null,68000,'EUR','year'), undefined);
  assert.equal(greenhouseSalary('<div class="title">Annual salary</div><div class="pay-range"><span>$90,000</span><span>&mdash;</span><span>$110,000 USD</span></div>'), 'Annual salary · $90,000–$110,000 USD');
  assert.equal(greenhouseSalary('We offer a competitive salary.'), undefined);
});
