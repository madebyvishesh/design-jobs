import { test } from 'node:test';
import assert from 'node:assert/strict';
import { experienceLevel, remoteEligibility } from '../lib/discoveryFilters';
import { readBrowseParams, writeBrowseParams } from '../lib/browseParams';

test('remote eligibility distinguishes unrestricted, named, and missing locations', () => {
  assert.equal(remoteEligibility('Remote (Worldwide)').worldwide, true);
  assert.equal(remoteEligibility('US remote').countries.has('US'), true);
  assert.equal(remoteEligibility('London / Remote (Germany)').countries.has('DE'), true);
  assert.equal(remoteEligibility('Remote (United States and India)').countries.size, 2);
  assert.equal(remoteEligibility('Remote').unspecified, true);
  for (const place of ['APAC', 'Remote in California', 'Toronto, CA', 'Remote except US']) {
    const region = remoteEligibility(place);
    assert.equal(region.unspecified, false);
    assert.equal(region.worldwide, false);
    assert.equal(region.countries.size, 0);
  }
});

test('level filter labels only explicit seniority', () => {
  assert.equal(experienceLevel('Principal Product Designer'), 'staff');
  assert.equal(experienceLevel('Design Intern'), 'intern');
  assert.equal(experienceLevel('Product Designer'), 'unknown');
});

test('multi-field shared links retain other criteria and normalize country selection', () => {
  const url = new URLSearchParams('field=product,systems,product&pay=1&level=senior&country=IN&company=A&ref=home');
  const state = readBrowseParams(url);
  assert.equal(state.remote, true);
  assert.equal(state.field.split(',').length, 2);
  writeBrowseParams(url, state);
  assert.deepEqual(readBrowseParams(url), state);
  assert.equal(url.get('ref'), 'home');
  assert.equal(readBrowseParams(new URLSearchParams('country=invalid&unspecified=1')).unspecified, false);
});
