import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexJob, searchTerms, jobMatches, highlightWords } from '../lib/jobSearch';
import { readBrowseParams, writeBrowseParams } from '../lib/browseParams';
import type { Job } from '../types/job';

const job = {
  title: 'Senior Product Designer – User Experience', company: 'Ateliê', location: 'São Paulo / U.S.',
  isRemote: true, isAI: false,
} as Job;
const matches = (query: string, listing = job, fuzzy = false) => jobMatches(indexJob(listing), searchTerms(query), fuzzy);

test('combines every word across fields, independent of order and accents', () => {
  for (const q of [' remote   DESIGNER product ', 'UX Atelie São', 'sr. sao-paulo designer', 'united states designer', 'designer U.S.A.'])
    assert.ok(matches(q), q);
  assert.ok(!matches('designer london'));
  assert.ok(!matches('remote designer', { ...job, isRemote: false }));
  assert.ok(!matches('us', { ...job, title: 'Business Designer', location: 'London' }));
});

test('only fuzzy title matching admits minor spelling errors', () => {
  for (const word of ['desginer', 'desiger', 'designerr', 'desiwner']) {
    assert.ok(!matches(word));
    assert.ok(matches('remote ' + word, job, true), word);
  }
  assert.ok(!matches('desginer london', job, true));
  assert.ok(!matches('atleie', job, true));
  assert.ok(!matches('designer', { ...job, title: 'Accountant' }, true));
});

test('highlighting retains original spelling, characters and punctuation', () => {
  const text = 'Senior UI/UX — São Paulo';
  const parts = highlightWords(text, searchTerms('ux sao'));
  assert.deepEqual(parts.filter(part => part.matched).map(part => part.value), ['UX', 'São']);
  assert.equal(parts.map(part => part.value).join(''), text);
  assert.deepEqual(searchTerms('  / ()  '), []);
  assert.ok(matches('東京', { ...job, location: '東京' }));
});

test('search URLs preserve criteria and unrelated parameters, validate unknown values', () => {
  const url = new URLSearchParams('ref=home&q=UX+remote&remote=1&week=1&portal=ashby&scope=ai&sort=company%2B');
  const state = readBrowseParams(url);
  assert.equal(state.sortKey, 'company');
  assert.equal(state.ascending, true);
  writeBrowseParams(url, state);
  assert.deepEqual(readBrowseParams(url), state);
  const defaults = readBrowseParams(new URLSearchParams('sort=constructor%2B&portal=bad'));
  assert.equal(defaults.source, 'all');
  assert.equal(defaults.sortKey, 'postedAt');
  writeBrowseParams(url, defaults);
  assert.equal(url.toString(), 'ref=home');
});
