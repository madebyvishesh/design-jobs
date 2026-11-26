import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBrowseParams } from '../lib/browseParams';
import { prepareListing, browsePool, selectedHits, recoveryChoices } from '../lib/browseMatches';
import { remoteEligibility, remoteBadge } from '../lib/discoveryFilters';
import { isDesignRole } from '../lib/filterJobs';
import { normalizeListing, listedPlaces } from '../lib/listingText';
import type { Job } from '../types/job';

const now = Date.parse('2026-11-26');
const role = (id:string, values: Partial<Job> = {}): Job => ({id,company:'Studio',companyDomain:'studio.example',isAI:false,isRemote:true,
  url:'https://studio.example/job/'+id,title:'Senior UX Researcher',location:'Remote (India)',department:'Design',postedAt:'2026-11-25',
  dateKind:'posted',ats:'ashby',sources:['ashby'],firstSeenAt:now,...values});
const ctx = {liveIds:new Set(['one','two','three']),hiddenIds:new Set<string>(),saved:new Set<string>(),showHidden:false,previousVisit:now-2000,fetchedAt:now};
const criteria = (query:string) => readBrowseParams(new URLSearchParams(query));

test('geographic and design aliases match together before pagination',()=>{
  const rows = [role('one',{location:'Bangalore'}),role('two',{location:'Bengaluru',title:'Senior User Experience Researcher'})].map(prepareListing);
  for (const city of ['bangalore','bengaluru']) for(const title of ['UXR','UX researcher']) {
    const c = criteria('q='+city+' '+title);
    assert.deepEqual(selectedHits(browsePool(rows,c,ctx),c,ctx).hits.map(r=>r.job.id),['one','two']);
  }
});
test('remote country selection isolates employer-marked remote places',()=>{
  for(const [loc,expected] of [
    ['Remote, Utah, United States of America · Remote, California, United States of America',['US']],
    ['Boston, MA; Remote - US; Remote  - CAN',['US','CA']],
    ['Remote, Atlanta, Georgia, United States',['US']], ['Remote (Worldwide) · except India',[]], ['Remote in California',['US']], ['Work at Home, Texas, United States',['US']], ['Germany · India',['DE','IN']], ['Remote (EU)',null],
    ['San Francisco, CA / Remote (India)',['IN']], ['United States (Remote) · Toronto, Canada',['US']],
    ['Remote except US',[]],['Toronto, CA',[]],['CA',[]], ['Boston, MA; Remote',[]],
  ] as const) {
    const region=remoteEligibility(loc);
    if(expected) assert.deepEqual(Array.from(region.countries),expected,loc);
    else assert.equal(region.countries.size,27);
  }
  assert.equal(remoteEligibility('Remote (Worldwide) · except India').worldwide,false);
  assert.equal(remoteBadge('Remote - EMEA'), 'Remote · EMEA');
  assert.equal(remoteBadge('Remote'), 'Remote · Region unclear');
  assert.equal(remoteBadge('US remote'), 'Remote · US');
});
test('hardware engineering excluded while digital roles survive',()=>{
  for(const title of ['Advanced Packaging Design Engineering Team Lead','High-Speed SerDes Design Engineer','Semiconductor Design Engineer']) assert.equal(isDesignRole(title),false);
  for(const title of ['Design Engineer, Brand & Marketing','Senior Packaging Designer','Senior UXR','DesignOps Lead','Design Technologist']) assert.equal(isDesignRole(title),true);
});
test('decodes display and search strings and keeps city-state pairs together',()=>{
  const job=normalizeListing(role('one',{location:'Bangalore, Karn&#x101;taka, IN · M&#252;nchen; Montr&eacute;al',title:'UX &amp; UI Designer'}));
  assert.deepEqual(listedPlaces(job.location),['Bangalore, Karnātaka, IN','München','Montréal']);
  assert.equal(job.title,'UX & UI Designer');
  assert.deepEqual(normalizeListing(job),job);
  assert.equal(normalizeListing(role('home',{isRemote:false,location:'Work at Home, Texas, United States'})).isRemote,true);
});
test('recovery counts exactly the result of changing one filter, preserving other constraints',()=>{
  const rows=[role('one'),role('two',{location:'Remote (US)',salary:'$80k'}),role('three',{title:'Brand Designer'})].map(prepareListing);
  const c=criteria('country=IN&level=senior&q=UXR&pay=1&week=1');
  assert.equal(selectedHits(browsePool(rows,c,ctx),c,ctx).hits.length,0);
  const choice=recoveryChoices(rows,c,ctx)[0];
  assert.equal(choice.label,'Show 1 role without listed pay');
  assert.deepEqual(choice.change,{salary:false});
  const retained={...c,...choice.change};
  assert.deepEqual(selectedHits(browsePool(rows,retained,ctx),retained,ctx).hits.map(j=>j.job.id),['one']);
});

test('outage carryovers obey current role and text rules',async()=>{
  const {withFirstSeen}=await import('../lib/firstSeen');
  const prior={aiJobs:[],allJobs:[role('old',{title:'SerDes Design Engineer'}),role('current',{location:'Karn&#x101;taka'})],fetchedAt:now};
  const next=withFirstSeen({aiJobs:[],allJobs:[],fetchedAt:now+1,report:[
    {source:'ashby',board:'studio',domain:'studio.example',status:'unavailable',received:0}]},prior);
  assert.deepEqual(next.allJobs.map(j=>[j.id,j.location]),[['current','Karnātaka']]);
});
