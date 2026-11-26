import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPages, type BoardReport } from '../lib/boardFetch';
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
