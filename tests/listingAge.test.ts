import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expiredListingIds, listingKnownSince, sixMonthCutoff } from '../lib/listingAge';
import { withFirstSeen } from '../lib/firstSeen';
import { mergePostings } from '../lib/mergePostings';
import { readPages } from '../lib/boardFetch';
import type { JobsPayload } from '../lib/jobsCache';
import type { Job } from '../types/job';

const at = Date.parse;
const now = at('2026-11-26T16:00Z');
const cutoff = at('2026-05-26');
const board = { board: 'studio', source: 'ashby', domain: 'studio.test', status: 'ok', received: 1 } as const;
function role(id: string, fields: Partial<Job> = {}): Job {
  return { id, title: 'Designer', department: 'Design', location: 'NY', isRemote: false, isAI: false,
    company: 'Studio', companyDomain: board.domain, url: 'https://studio.test/jobs/' + id, ats: 'ashby',
    boardKey: 'ashby:studio', sources: ['ashby'], postedAt: '2026-09-01', dateKind: 'posted', ...fields };
}
function run(roles: Job[], previous: JobsPayload | null = null, fetchedAt = now) {
  return withFirstSeen({ aiJobs: roles.filter(j => j.isAI), allJobs: roles.filter(j => !j.isAI), fetchedAt, report: [board] }, previous);
}

test('six calendar months in UTC, including short months, leap days and year boundaries', () => {
  for (const [day, expected] of [
    ['2026-11-26T23:59:59Z', '2026-05-26'], ['2026-08-31', '2026-02-28'],
    ['2024-08-31', '2024-02-29'], ['2026-01-31', '2025-07-31'], ['2026-03-31', '2025-09-30'],
  ]) assert.equal(sixMonthCutoff(at(day)), at(expected));
});

test('includes the whole cutoff day, removes older posted, created and updated dates in both scopes', () => {
  const jobs = run([
    role('before', {postedAt:'2026-05-25T23:59:59.999Z'}), role('start', {postedAt:'2026-05-26T00:00:00Z'}),
    role('end', {postedAt:'2026-05-26T23:59:59Z', isAI:true}), role('offset', {postedAt:'2026-05-26T01:00:00+02:00'}),
    role('created', {postedAt:'2025-10-01',dateKind:'created',isAI:true}), role('updated', {postedAt:'2025-10-01',dateKind:'updated'}),
  ]);
  assert.deepEqual(jobs.allJobs.map(j=>j.id), ['start']);
  assert.deepEqual(jobs.aiJobs.map(j=>j.id), ['end']);
  assert.equal(jobs.expiredCount,4);
  assert.ok(expiredListingIds(jobs, sixMonthCutoff(at('2026-11-27'))).includes('end'));
});

test('unknown, epoch, malformed and future dates age from the first observation', () => {
  for (const [date,kind] of [['2020-11-01','unknown'],['invalid','posted'],['0','posted'],['2026-02-30','posted'],['1970-01-01','posted'],['2035-01-01','posted']] as const) {
    const job = role('x', {postedAt:date, dateKind:kind});
    const legacy = {allJobs:[job], aiJobs:[], fetchedAt:cutoff};
    const result = run([job],legacy);
    assert.equal(result.allJobs[0].knownSince,cutoff);
    assert.equal(run([job],result,at('2026-11-27')).allJobs.length,0);
  }
});

test('edits, date loss, outages, and a returning ID never make an old posting new', () => {
  const old = role('old',{postedAt:'2026-05-20'});
  const before = run([old], null, at('2026-05-30'));
  const empty = run([],before);
  const renamed = role('old',{postedAt:'2026-11-26', title:'Senior Designer', dateKind:'updated'});
  const replacement = role('new',{title:renamed.title});
  const result = run([renamed,replacement],empty);
  assert.deepEqual(result.allJobs.map(j=>j.id), ['new']);
  assert.equal(result.ageEvidence?.old,at('2026-05-20'));
  assert.deepEqual(expiredListingIds(result,cutoff),['old']);
  assert.equal(run([role('old',{postedAt:'',dateKind:'unknown'})], result).allJobs.length,0);
  const previous = run([old,role('young')],null,at('2026-06-15'));
  const outage = withFirstSeen({aiJobs:[],allJobs:[],fetchedAt:now,report:[{...board,status:'unavailable'}]},previous);
  assert.deepEqual(outage.allJobs.map(j=>[j.id,j.lastVerifiedAt]), [['young',previous.fetchedAt]]);
  assert.equal(outage.expiredCount,1);
});

test('repeated IDs and mirrored sources retain earliest evidence and one copy during a partial outage', () => {
  const job = role('direct');
  const mirror = role('mirror',{ats:'yc',sources:['yc'],url:job.url+'?utm_source=mirror',postedAt:'2026-01-01'});
  const merged = mergePostings([job,mirror]);
  assert.equal(merged.length,1);
  assert.equal(listingKnownSince(merged[0],now),at('2026-01-01'));
  assert.equal(run(mergePostings([job,{...mirror,id:job.id}])).allJobs.length,0);
  const prior = run([mirror],null,at('2026-03-05'));
  const switched = withFirstSeen({allJobs:[job],aiJobs:[],fetchedAt:now,report:[{...board,status:'partial'}]},prior);
  assert.equal(switched.allJobs.length,0);
  assert.equal(switched.expiredCount,1);
});

test('an incomplete or shifting page sequence cannot replace a complete board', async () => {
  for (const total of [undefined,4]) {
    await assert.rejects(readPages(async n=>({items:n?['b','c']:['a','b'],total}),x=>x),/Overlapping/);
  }
  await assert.rejects(readPages(async n=>({items:n?['c']:['a','b'],total:n?3:4}),x=>x),/Inconsistent/);
});
