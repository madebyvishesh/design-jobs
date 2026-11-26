'use client';

import { useEffect, useRef, useState } from 'react';
import { Bookmark, X } from 'lucide-react';
import { readBrowseParams, writeBrowseParams, sources, columns, type BrowseCriteria } from '@/lib/browseParams';
import BoardSelect from './BoardSelect';
import { countries, levels } from '@/lib/discoveryFilters';
import { fields, type DesignField } from '@/lib/jobFields';

const KEY = 'design-jobs:searches';
function read(): string[] {
  const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
  return Array.isArray(raw) ? raw.filter(item => typeof item === 'string') : [];
}
function label(state: BrowseCriteria) {
  return [state.search.trim(), state.field !== 'all' && state.field.split(',').map(f=>fields[f as DesignField]).join(' or '), state.company,
    state.level !== 'all' && levels[state.level], state.salary && 'Salary listed', countries.find(c=>c.value===state.country)?.label, state.country && state.unspecified && 'Include unspecified regions', state.scope !== 'All roles' && state.scope,
    state.remote && 'Remote', state.week && 'Last 7 days', state.newest && 'New since last visit',
    state.source !== 'all' && sources[state.source as keyof typeof sources],
    state.explicitSort && (state.sortKey === 'postedAt' ? state.ascending ? 'Oldest first' : 'Newest first' :
      columns[state.sortKey] + (state.ascending ? ' A–Z' : ' Z–A'))].filter(Boolean).join(' · ') || 'All roles';
}

export default function SavedSearches({ criteria, apply }: { criteria: BrowseCriteria; apply: (state: BrowseCriteria) => void }) {
  const [items, setItems] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const temporary = useRef(false);
  const params = new URLSearchParams();
  writeBrowseParams(params, criteria);
  const key = params.toString();
  const saved = items.includes(key);
  useEffect(() => {
    function sync() { try { if (!temporary.current) setItems(read()); } catch { /* Session-only searches. */ } }
    sync(); window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  function toggle() {
    let previous = items;
    try { if (!temporary.current) previous = read(); } catch { /* Use the session copy. */ }
    const remove = previous.includes(key);
    const next = remove ? previous.filter(item => item !== key) : [...previous, key];
    setItems(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); setStatus(remove ? 'Saved search removed.' : 'Search saved on this device.'); }
    catch { temporary.current = true; setStatus('Search preferences will last for this visit.'); }
  }
  if (!key && !items.length) return null;
  return <div className="saved-searches">
    {items.length > 0 && <BoardSelect id="saved-searches" label="Saved searches" placeholder="Choose a search" value={saved ? key : ''}
      options={items.map(item => ({ value: item, label: label(readBrowseParams(new URLSearchParams(item))) }))}
      onChange={value => apply(readBrowseParams(new URLSearchParams(value)))} />}
    <button className="board-control" type="button" onClick={toggle} disabled={!key}>
      {saved ? <X size={15} /> : <Bookmark size={15} />}{saved ? 'Remove saved search' : 'Save this search'}
    </button>
    <span className="sr-only" role="status">{status}</span>
  </div>;
}
