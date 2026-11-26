import type { Job } from '../types/job';
import type { BrowseCriteria } from './browseParams';
import { experienceLevel, remoteEligibility } from './discoveryFilters';
import { jobFields } from './jobFields';
import { indexJob, jobMatches, searchTerms } from './jobSearch';

export function prepareListing(job: Job) {
  return { job, index: indexJob(job), fields: jobFields(job.title,job.department), level: experienceLevel(job.title),
    region: job.isRemote ? remoteEligibility(job.location) : null };
}

type Listing = ReturnType<typeof prepareListing>;
export type BrowseContext = { liveIds: Set<string>; saved: Set<string>; hiddenIds: Set<string>;
  showHidden: boolean; previousVisit: number | null; fetchedAt: number };

export function browsePool(rows: Listing[], c: BrowseCriteria, ctx: BrowseContext) {
  return rows.filter(({job,level,region}) => {
    if (c.scope === 'Saved' ? !ctx.saved.has(job.id) : !ctx.liveIds.has(job.id)) return false;
    if (ctx.showHidden ? !ctx.hiddenIds.has(job.id) : ctx.hiddenIds.has(job.id) && c.scope !== 'Saved') return false;
    if (c.scope === 'AI companies' && !job.isAI) return false;
    if ((c.remote || c.country) && !job.isRemote) return false;
    if (c.company && c.company !== job.company || c.salary && !job.salary || c.level !== 'all' && level !== c.level) return false;
    if (c.source !== 'all' && !(job.sources?.length ? job.sources : [job.ats]).some(source=>source===c.source)) return false;
    if (c.country && !(region?.worldwide || region?.countries.has(c.country) || c.unspecified && region?.unspecified)) return false;
    const age = ctx.fetchedAt - Date.parse(job.postedAt);
    return !c.week || job.dateKind === 'posted' && age >= 0 && age <= 7 * 86400000;
  });
}

export function searchPool(rows: Listing[], search: string) {
  const terms = searchTerms(search);
  if (search.trim() && !terms.length) return {hits:[], close:false};
  const hits = terms.length ? rows.filter(row=>jobMatches(row.index,terms)) : rows;
  if (hits.length || !terms.some(term=>term.length>=5)) return {hits,close:false};
  return {hits:rows.filter(row=>jobMatches(row.index,terms,true)),close:true};
}

export function isNewListing(job: Job, ctx: BrowseContext) {
  return ctx.previousVisit !== null && (job.firstSeenAt ?? 0) > ctx.previousVisit && ctx.liveIds.has(job.id);
}

export function selectedHits(pool: Listing[], c: BrowseCriteria, ctx: BrowseContext) {
  const selected = c.field.split(',');
  const fieldRows = c.field === 'all' ? pool : pool.filter(row=>row.fields.some(f=>selected.includes(f)));
  const {hits,close} = searchPool(fieldRows,c.search);
  const newHits = hits.filter(({job})=>isNewListing(job,ctx));
  return {hits:c.newest ? newHits : hits, close, newCount:newHits.length};
}

export function recoveryChoices(rows: Listing[], criteria: BrowseCriteria, ctx: BrowseContext) {
  const changes: [Partial<BrowseCriteria>,string][] = [];
  if (criteria.week) changes.push([{week:false},'older matches']);
  if (criteria.salary) changes.push([{salary:false},'without listed pay']);
  if (criteria.newest) changes.push([{newest:false},'from earlier visits']);
  if (criteria.level !== 'all') changes.push([{level:'all'},'at other experience levels']);
  if (criteria.source !== 'all') changes.push([{source:'all'},'on other portals']);
  if (criteria.field !== 'all') changes.push([{field:'all'},'in other fields']);
  if (criteria.country) changes.push([{country:'',unspecified:false},'across remote regions']);
  else if (criteria.remote) changes.push([{remote:false},'with other work arrangements']);
  if (criteria.company) changes.push([{company:''},'at other companies']);
  const choices = [];
  for (const [change,description] of changes) {
    const next = {...criteria,...change};
    const count = selectedHits(browsePool(rows,next,ctx),next,ctx).hits.length;
    if (count) choices.push({change, label:description==='older matches' ? 'Show older matches ('+count+')' :
      'Show '+count+' '+(count===1?'role':'roles')+' '+description});
    if (choices.length===2) break;
  }
  return choices;
}
