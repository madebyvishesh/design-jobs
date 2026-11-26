'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, X } from 'lucide-react';
import { readBrowseParams, writeBrowseParams, sources, columns, type BrowseCriteria } from '@/lib/browseParams';
import BoardSelect from './BoardSelect';
import { countries, levels } from '@/lib/discoveryFilters';
import { arrangements, employmentTypes } from '@/lib/workFilters';
import { fields, type DesignField } from '@/lib/jobFields';

const KEY = 'design-jobs:searches';
function read(): string[] {
  const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
  return Array.isArray(raw) ? raw.filter(item => typeof item === 'string') : [];
}
function label(state: BrowseCriteria) {
  return [state.search.trim(), state.field !== 'all' && state.field.split(',').map(f=>fields[f as DesignField]).join(' or '), state.company,
    state.city, state.arrangement && arrangements[state.arrangement as keyof typeof arrangements], state.employment && employmentTypes[state.employment as keyof typeof employmentTypes],
    state.target && 'Range reaches '+state.currency+' '+state.target+'/'+state.period, state.hideApplied && 'Hide applied',
    state.level !== 'all' && state.level.split(',').map(l=>levels[l as keyof typeof levels]).join(' or '), state.salary && 'Salary listed', countries.find(c=>c.value===state.country)?.label, state.country && state.unspecified && 'Include unspecified regions', state.scope !== 'All roles' && state.scope,
    state.remote && 'Remote', state.week && 'Last 7 days', state.newest && 'New since last visit',
    state.source !== 'all' && sources[state.source as keyof typeof sources],
    state.explicitSort && (state.sortKey === 'postedAt' ? state.ascending ? 'Oldest first' : 'Newest first' :
      columns[state.sortKey] + (state.ascending ? ' A–Z' : ' Z–A'))].filter(Boolean).join(' · ') || 'All roles';
}

const SEEN_KEY = KEY + ':checked';
type History = Record<string, number>;
function readHistory(): History {
  const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}');
  return Object.fromEntries(Object.entries(raw ?? {}).filter(([,time])=>typeof time === 'number' && time > 0 && Number.isFinite(time))) as History;
}

export default function SavedSearches({ criteria, apply, fetchedAt, countNew }: {
  criteria: BrowseCriteria; apply: (state: BrowseCriteria) => void; fetchedAt: number;
  countNew: (state: BrowseCriteria, since: number) => number;
}) {
  const [items, setItems] = useState<string[]>([]);
  const [history,setHistory] = useState<History>({});
  const [status, setStatus] = useState('');
  const temporary = useRef(false);
  const viewed = useRef<string | null>(null);
  const params = new URLSearchParams();
  writeBrowseParams(params, criteria);
  const key = params.toString();
  const saved = items.includes(key);

  useEffect(() => {
    function sync() {
      if (temporary.current) return;
      try {
        const keys = read(), seen = readHistory();
        let migrated = false;
        for (const key of keys) if (!seen[key]) { seen[key] = fetchedAt; migrated = true; }
        setItems(keys); setHistory(seen);
        if (migrated) localStorage.setItem(SEEN_KEY,JSON.stringify(seen));
      } catch { temporary.current = true; }
    }
    function changed(event: StorageEvent) {
      if (!event.key || event.key === KEY || event.key === SEEN_KEY) sync();
    }
    sync(); window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [fetchedAt]);

  const markRead = useCallback((value: string) => {
    let next = {...history};
    try { if (!temporary.current) next = readHistory(); } catch { temporary.current = true; }
    next[value] = Math.max(fetchedAt,next[value] || 0);
    setHistory(next);
    try { localStorage.setItem(SEEN_KEY,JSON.stringify(next)); } catch { temporary.current = true; }
  },[fetchedAt,history]);

  const options = useMemo(()=>items.map(value=>{
    const criteria = readBrowseParams(new URLSearchParams(value));
    const count = countNew(criteria,history[value] ?? fetchedAt);
    return {value,label:label(criteria)+(count ? ' · '+count+' new' : ''),count};
  }),[items,history,fetchedAt,countNew]);

  useEffect(()=>{
    if (!saved) { viewed.current = null; setStatus(''); return; }
    if (viewed.current === key) return;
    viewed.current = key;
    const count = options.find(item=>item.value===key)?.count ?? 0;
    setStatus(count ? count+' new '+(count===1?'match':'matches')+' since you last opened this search.' : '');
    markRead(key);
  },[key,saved,options,markRead]);

  function toggle() {
    let previous = items;
    try { if (!temporary.current) previous = read(); } catch { temporary.current = true; }
    const remove = previous.includes(key);
    const next = remove ? previous.filter(item => item !== key) : [...previous, key];
    setItems(next);
    if (!remove) { viewed.current = key; markRead(key); }
    try { localStorage.setItem(KEY, JSON.stringify(next)); setStatus(remove ? 'Saved search removed.' : 'Search saved on this device.'); }
    catch { temporary.current = true; setStatus('Search preferences will last for this visit.'); }
  }
  if (!key && !items.length) return null;
  return <div className="saved-searches">
    {items.length > 0 && <BoardSelect id="saved-searches" label="Saved searches" placeholder="Open a saved search" value=""
      options={options} onChange={value=>{
        const item = options.find(option=>option.value===value);
        viewed.current=value; markRead(value);
        setStatus(item?.count ? item.count+' new '+(item.count===1?'match':'matches')+' since you last opened this search.' : 'Saved search opened.');
        apply(readBrowseParams(new URLSearchParams(value)));
      }} />}
    <button className="board-control" type="button" onClick={toggle} disabled={!key}>
      {saved ? <X size={15} /> : <Bookmark size={15} />}{saved ? 'Remove saved search' : 'Save this search'}
    </button>
    <span className="saved-search-feedback" role="status">{status}</span>
  </div>;
}
