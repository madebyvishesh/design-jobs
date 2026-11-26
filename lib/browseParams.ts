import { arrangements, employmentTypes, payPeriods } from './workFilters';
import { fields } from './jobFields';
import { countries, levels } from './discoveryFilters';
import type { AtsSource } from '@/types/job';

export const sources: Record<AtsSource, string> = {
  yc: 'Y Combinator', ashby: 'Ashby', greenhouse: 'Greenhouse', lever: 'Lever', remotive: 'Remotive', workday: 'Workday', employer: 'Company careers',
};
export const columns = { title: 'Role', company: 'Company', location: 'Location', postedAt: 'Listing date' };
export type SortKey = keyof typeof columns;
export const scopes = ['All roles', 'AI companies', 'Saved'] as const;
export type Scope = typeof scopes[number];

export function readBrowseParams(params: Pick<URLSearchParams, 'get'>) {
  const value = params.get('sort') ?? '';
  const key = value.slice(0, -1) as SortKey;
  const validSort = Object.hasOwn(columns, key) && /[+-]$/.test(value);
  const source = params.get('portal') ?? '';
  const selected = (params.get('field') || '').split(',');
  const field = Object.keys(fields).filter(key => selected.includes(key)).join(',') || 'all';
  const selectedLevels = (params.get('level') || '').split(',');
  const level = Object.keys(levels).filter(l=>selectedLevels.includes(l)).join(',') || 'all';
  const amount = params.get('target') || '';
  const currency = (params.get('currency') || 'USD').toUpperCase();
  const period = params.get('period') || 'year';
  const arrangement = params.get('work') || '';
  const employment = params.get('type') || '';
  const country = countries.find(c => c.value === params.get('country'))?.value || '';
  const scope = params.get('scope');
  return {
    field, company: params.get('company') || '',
    level, city: country ? '' : (params.get('city') || '').trim(),
    arrangement: !country && Object.hasOwn(arrangements,arrangement) && arrangement!=='remote' ? arrangement : '',
    employment: Object.hasOwn(employmentTypes,employment) ? employment : '',
    target: /^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount)>0 && Number.isFinite(Number(amount)) ? amount : '',
    currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
    period: Object.hasOwn(payPeriods,period) ? period : 'year',
    hideApplied: params.get('hideApplied')==='1',
    salary: params.get('pay') === '1', country,
    unspecified: Boolean(country) && params.get('unspecified') === '1',
    newest: params.get('new') === '1',
    explicitSort: validSort,
    search: params.get('q') || '',
    scope: scope === 'ai' ? 'AI companies' as const : scope === 'saved' ? 'Saved' as const : 'All roles' as const,
    remote: Boolean(country) || arrangement==='remote' || (!Object.hasOwn(arrangements,arrangement) && params.get('remote') === '1'), week: params.get('week') === '1',
    source: Object.hasOwn(sources, source) ? source : 'all',
    sortKey: validSort ? key : 'postedAt' as const, ascending: validSort && value.endsWith('+'),
  };
}

export function writeBrowseParams(params: URLSearchParams, state: ReturnType<typeof readBrowseParams>) {
  const values = {
    field: state.field === 'all' ? '' : state.field, new: state.newest ? '1' : '',
    city:state.city, work:state.arrangement,type:state.employment,target:state.target,
    currency:state.currency==='USD'?'':state.currency,period:state.period==='year'?'':state.period,hideApplied:state.hideApplied?'1':'',
    company: state.company, level: state.level === 'all' ? '' : state.level, pay: state.salary ? '1' : '',
    country: state.country, unspecified: state.country && state.unspecified ? '1' : '', q: state.search.trim(), scope: state.scope === 'Saved' ? 'saved' : state.scope === 'AI companies' ? 'ai' : '',
    remote: state.remote ? '1' : '', week: state.week ? '1' : '', portal: state.source === 'all' ? '' : state.source,
    sort: !state.explicitSort && state.sortKey === 'postedAt' && !state.ascending ? '' : state.sortKey + (state.ascending ? '+' : '-'),
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
}

export type BrowseCriteria = ReturnType<typeof readBrowseParams>;
