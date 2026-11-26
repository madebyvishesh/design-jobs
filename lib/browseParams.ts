import type { AtsSource } from '@/types/job';

export const sources: Record<AtsSource, string> = {
  yc: 'Y Combinator', ashby: 'Ashby', greenhouse: 'Greenhouse', lever: 'Lever', remotive: 'Remotive', workday: 'Workday',
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
  const scope = params.get('scope');
  return {
    search: params.get('q') || '',
    scope: scope === 'ai' ? 'AI companies' as const : scope === 'saved' ? 'Saved' as const : 'All roles' as const,
    remote: params.get('remote') === '1', week: params.get('week') === '1',
    source: Object.hasOwn(sources, source) ? source : 'all',
    sortKey: validSort ? key : 'postedAt' as const, ascending: validSort && value.endsWith('+'),
  };
}

export function writeBrowseParams(params: URLSearchParams, state: ReturnType<typeof readBrowseParams>) {
  const values = {
    q: state.search.trim(), scope: state.scope === 'Saved' ? 'saved' : state.scope === 'AI companies' ? 'ai' : '',
    remote: state.remote ? '1' : '', week: state.week ? '1' : '', portal: state.source === 'all' ? '' : state.source,
    sort: state.sortKey === 'postedAt' && !state.ascending ? '' : state.sortKey + (state.ascending ? '+' : '-'),
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
}

export type BrowseCriteria = ReturnType<typeof readBrowseParams>;
