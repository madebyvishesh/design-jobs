import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPages, readBoardJson, BoardMissing, type BoardReport } from '../lib/boardFetch';
import { mergePostings } from '../lib/mergePostings';
import { withFirstSeen } from '../lib/firstSeen';
import type { Job } from '../types/job';

test('reads every provider page and surfaces repeated or incomplete pages', async () => {
  const ids = Array.from({length: 127}, (_,i) => String(i));
  for (const total of [undefined, ids.length]) {
    const results = await readPages(async offset => ({ items: ids.slice(offset, offset+20), total }), x=>x);
    assert.deepEqual(results, ids);
  }
  await assert.rejects(readPages(async () => ({ items: ['a'] }), x=>x), /repeated/);
  await assert.rejects(readPages(async offset => ({ items: offset ? [] : ['a'], total: 3 }), x=>x), /Incomplete/);
});
const role = (id: string): Job => ({id, title:'Product Designer', company:'Studio', companyDomain:'studio.example',
  postedAt:'2026-11-26', url:'https://studio.example/jobs/'+id, location:'NYC', department:'Design',
  isRemote:false, isAI:false, ats:'greenhouse', sources:['greenhouse'], boardKey:'greenhouse:studio'});
test('distinct requisitions keep their identity even with identical company, title and location', () => {
  assert.deepEqual(mergePostings([role('1'),role('2'),role('1')]).map(j=>j.id),['1','2']);
  assert.equal(mergePostings([role('1'),{...role('3'),url:role('1').url+'?utm_source=a'}]).length,1);
});
test('unavailable board retains old roles while a confirmed empty board clears them', () => {
  const prev={fetchedAt:10,aiJobs:[],allJobs:[role('old')]};
  const board: BoardReport={source:'greenhouse',board:'studio',domain:'studio.example',status:'unavailable',received:0};
  const next={fetchedAt:20,aiJobs:[],allJobs:[],report:[board]};
  assert.equal(withFirstSeen(next,prev).allJobs[0].lastVerifiedAt,10);
  assert.equal(withFirstSeen({...next,report:[{...board,status:'ok'}]},prev).allJobs.length,0);
});

test('retries a transient page once, using a fresh signal and the same page', async t => {
  const signals: AbortSignal[] = [];
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    signals.push(init.signal!);
    urls.push(url);
    return signals.length === 1
      ? new Response(null, { status: 429, headers: { 'Retry-After': '0' } })
      : Response.json([{ id: 'job' }]);
  });
  assert.deepEqual(await readBoardJson('https://example.test/jobs?skip=100'), [{ id: 'job' }]);
  assert.equal(signals.length, 2);
  assert.notEqual(signals[0], signals[1]);
  assert.equal(urls[0], urls[1]);
});

test('surfaces a long retry interval, a challenge and a retired board immediately', async t => {
  const responses = [
    new Response(null, { status: 429, headers: { 'Retry-After': '3600' } }),
    new Response(null, { status: 429, headers: { 'cf-mitigated': 'challenge' } }),
    new Response(null, { status: 404 }),
  ];
  const fetch = t.mock.method(globalThis, 'fetch', async () => responses.shift()!);
  const url = 'https://example.test/jobs';
  await assert.rejects(readBoardJson(url), /Retry-After 3600s/);
  await assert.rejects(readBoardJson(url), /challenge/);
  await assert.rejects(readBoardJson(url), BoardMissing);
  assert.equal(fetch.mock.callCount(), 3);
});
