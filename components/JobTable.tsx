'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Bookmark, BookmarkCheck, Check, Copy, List, Rows3, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Job, AtsSource } from '@/types/job';

const PAGE_SIZE = 50;
const SAVED_KEY = 'design-jobs:saved';
const MODE_KEY = 'design-jobs:view-mode';
const sources: Record<AtsSource, string> = {
  yc: 'YC', ashby: 'Ashby', greenhouse: 'Greenhouse', lever: 'Lever', remotive: 'Remotive', workday: 'Workday',
};
const columns = { title: 'Role', company: 'Company', location: 'Location', postedAt: 'Date' };
type SortKey = keyof typeof columns;
type Scope = 'All roles' | 'AI & frontier' | 'Saved';
const scopes: Scope[] = ['All roles', 'AI & frontier', 'Saved'];
const mobileQuery = '(max-width: 799px)';
function subscribeLayout(listener: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
const onMobile = () => window.matchMedia(mobileQuery).matches;
const serverMobile = () => false;

function readSaved() {
  const ids: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
  return new Set<string>(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []);
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const value = text || '';
  const needle = query.trim();
  if (!needle) return <>{value}</>;

  const lower = value.toLowerCase();
  const target = needle.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let index = lower.indexOf(target);

  while (index !== -1) {
    if (index > cursor) parts.push(value.slice(cursor, index));
    parts.push(
      <mark key={`${index}-${target}`} className="radius-chip bg-[hsl(var(--accent-lime)/0.28)] px-0.5 text-inherit">
        {value.slice(index, index + target.length)}
      </mark>
    );
    cursor = index + target.length;
    index = lower.indexOf(target, cursor);
  }

  if (cursor < value.length) parts.push(value.slice(cursor));
  return <>{parts}</>;
}

function CompanyAvatar({ job, size = 'md' }: { job: Job; size?: 'sm' | 'md' }) {
  const [imgError, setImgError] = useState(false);
  const initial = job.company.charAt(0).toUpperCase();
  const imgSrc = !imgError
    ? (job.logoUrl || (job.companyDomain ? `https://www.google.com/s2/favicons?domain=${job.companyDomain}&sz=64` : null))
    : null;
  const dimensions = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const tileTone = imgSrc ? 'dark:border-white/15 dark:bg-white dark:text-slate-950' : '';

  return (
    <span className={`${dimensions} ${tileTone} radius-control inline-flex shrink-0 items-center justify-center border border-border bg-card text-xs font-medium text-muted-foreground`}>
      {imgSrc ? (
        <img
          loading="lazy"
          src={imgSrc}
          alt=""
          width={size === 'sm' ? 20 : 24}
          height={size === 'sm' ? 20 : 24}
          className="object-contain"
          onError={() => setImgError(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

interface Props {
  jobs: Job[];
  fetchedAt: number;
  checked: string;
}

export default function JobTable({ jobs, fetchedAt, checked }: Props) {
  const [scope, setScope] = useState<Scope>('All roles');
  const [search, setSearch] = useState('');
  const [remote, setRemote] = useState(false);
  const [week, setWeek] = useState(false);
  const [source, setSource] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('postedAt');
  const [ascending, setAscending] = useState(false);
  const [saved, setSaved] = useState(new Set<string>());
  const [detail, setDetail] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [range, setRange] = useState({ first: 0, last: 0 });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const storageUnavailable = useRef(false);
  function setPage(index: number) {
    setRange({ first: index, last: index });
  }
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLHeadingElement>(null);
  const mobile = useSyncExternalStore(subscribeLayout, onMobile, serverMobile);
  const query = search.trim().toLowerCase();

  useEffect(() => {
    function sync() {
      try {
        setSaved(readSaved());
        setDetail(localStorage.getItem(MODE_KEY) === 'detail');
      } catch { /* Keep in-memory preferences when browser storage is unavailable. */ }
    }
    function shortcut(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.closest('input, textarea, select'))) return;
      e.preventDefault();
      input.current?.focus();
    }
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('keydown', shortcut);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('keydown', shortcut);
    };
  }, []);

  function toggleSaved(job: Job) {
    let ids = new Set(saved);
    if (!storageUnavailable.current) {
      try { ids = readSaved(); } catch { /* Use the session copy. */ }
    }
    const adding = !ids.has(job.id);
    if (adding) ids.add(job.id);
    else ids.delete(job.id);
    setSaved(ids);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(ids)));
      setMessage((adding ? 'Saved ' : 'Removed ') + job.title);
    } catch {
      storageUnavailable.current = true;
      setMessage('Bookmark changed for this visit. Browser storage is unavailable.');
    }
  }

  function toggleDetail() {
    setDetail(!detail);
    try { localStorage.setItem(MODE_KEY, detail ? 'compact' : 'detail'); }
    catch { /* The view still changes for this visit. */ }
  }

  function resetFilters() {
    setSearch(''); setRemote(false); setWeek(false); setSource('all'); setPage(0);
  }

  function sortBy(key: SortKey, asc = sortKey === key ? !ascending : key !== 'postedAt') {
    setSortKey(key); setAscending(asc); setPage(0);
  }

  const savedCount = jobs.filter(job => saved.has(job.id)).length;
  const matches = useMemo(() => {
    const filtered = jobs.filter(job => {
      if (scope === 'Saved' && !saved.has(job.id)) return false;
      if (scope === 'AI & frontier' && !job.isAI) return false;
      if (remote && !job.isRemote) return false;
      if (source !== 'all' && !job.sources.some(value => value === source)) return false;
      if (week) {
        const age = fetchedAt - Date.parse(job.postedAt);
        if (job.dateKind !== 'posted' || !(age >= 0 && age <= 7 * 86400000)) return false;
      }
      return !query || [job.title, job.company, job.location].some(value => value.toLowerCase().includes(query));
    });
    return filtered.sort((a, b) => {
      if (sortKey === 'postedAt' && Boolean(a.postedAt) !== Boolean(b.postedAt)) return a.postedAt ? -1 : 1;
      const left = a[sortKey].toLowerCase();
      const right = b[sortKey].toLowerCase();
      const order = left < right ? -1 : left > right ? 1 : 0;
      return ascending ? order : -order;
    });
  }, [jobs, scope, saved, remote, source, week, fetchedAt, query, sortKey, ascending]);
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const current = Math.min(range.last, pages - 1);
  const firstPage = Math.min(range.first, current);
  const start = firstPage * PAGE_SIZE;
  const end = Math.min((current + 1) * PAGE_SIZE, matches.length);
  const visible = matches.slice(start, end);
  const hasFilters = Boolean(search || remote || week || source !== 'all');
  const emptySaved = scope === 'Saved' && savedCount === 0;

  function goToPage(next: number) {
    setPage(next);
    results.current?.focus({ preventScroll: true });
    results.current?.scrollIntoView({ block: 'start' });
  }

  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  async function copy(job: Job) {
    try {
      await navigator.clipboard.writeText(job.url);
      setCopiedId(job.id);
      setMessage('Copied link to ' + job.title);
    } catch { setMessage('Could not copy the link. Use the role title to open the listing.'); }
  }

  return (
    <div className="job-board">
      <div className="board-search">
        <Search size={20} aria-hidden="true" />
        <input ref={input} type="search" aria-label="Search jobs by role, company or location" placeholder="Search jobs"
          value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        {search ? <button type="button" aria-label="Clear search" onClick={() => { setSearch(''); setPage(0); input.current?.focus(); }}><X size={17} /></button> : <kbd aria-hidden="true">/</kbd>}
      </div>
      <div className="board-summary">
        <span>{jobs.length} roles · {new Set(jobs.map(job => job.company)).size} companies · {jobs.filter(job => job.isRemote).length} remote</span>
        <span>Last checked <time dateTime={new Date(fetchedAt).toISOString()}>{checked} IST</time></span>
      </div>
      <div className="board-toolbar">
        <div className="board-scopes" role="group" aria-label="Browse roles">
          {scopes.map(item => <button type="button" key={item} aria-pressed={scope === item}
            onClick={() => { setScope(item); setPage(0); }}>
            {item === 'Saved' && <Bookmark size={14} aria-hidden="true" />}
            {item}{item === 'Saved' && <span> ({savedCount})</span>}
          </button>)}
        </div>
        <div className="board-options">
          <label className="board-control"><input type="checkbox" checked={remote} onChange={e => { setRemote(e.target.checked); setPage(0); }} />Remote only</label>
          <button type="button" className="board-control" aria-expanded={filtersOpen} aria-controls="board-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
            <SlidersHorizontal size={15} />Filters{(week || source !== 'all') && <Check size={14} />}
          </button>
          <button type="button" className="board-control" aria-label="Detailed view" title="Detailed view" aria-pressed={detail} onClick={toggleDetail}>
            {detail ? <List size={17} /> : <Rows3 size={17} />}
          </button>
        </div>
      </div>
      <div id="board-filters" className="board-filters" hidden={!filtersOpen}>
        <label>Source<select value={source} onChange={e => { setSource(e.target.value); setPage(0); }}>
          <option value="all">All sources</option>{Object.entries(sources).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label>
        <label>Sort by<select value={sortKey + (ascending ? '+' : '-')} onChange={e => sortBy(e.target.value.slice(0, -1) as SortKey, e.target.value.endsWith('+'))}>
          {Object.entries(columns).flatMap(([id, name]) => ['+', '-'].map(dir =>
            <option key={id + dir} value={id + dir}>{id === 'postedAt' ? (dir === '+' ? 'Oldest first' : 'Newest first') : name + (dir === '+' ? ' A–Z' : ' Z–A')}</option>))}
        </select></label>
        <label className="board-control"><input type="checkbox" checked={week} onChange={e => { setWeek(e.target.checked); setPage(0); }} />Posted this week</label>
      </div>
      <div className="results-summary">
        <h2 tabIndex={-1} ref={results} aria-live="polite" aria-atomic="true">
          {matches.length ? (start + 1) + '–' + end + ' of ' + matches.length + ' roles' : '0 matching roles'}
        </h2>
        {hasFilters && <button type="button" onClick={resetFilters}>Clear filters</button>}
      </div>
      {visible.length ? <table className="listings-table" aria-label="Design job listings">
        <thead><tr>{(Object.keys(columns) as SortKey[]).map(key => <th key={key} scope="col" aria-sort={key === sortKey ? (ascending ? 'ascending' : 'descending') : undefined}>
          <button type="button" onClick={() => sortBy(key)}>{columns[key]}{key === sortKey && (ascending ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}</button>
        </th>)}<th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{visible.map(job => <tr key={job.id}>
          <td className="role-cell">
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="role-title"><HighlightText text={job.title} query={query} /></a>
            {detail && <div className="role-detail">{[job.department, job.sources.map(id => sources[id]).join(' · ')].filter(Boolean).join(' · ')}</div>}
          </td>
          <td className="company-cell"><a href={job.companyDomain ? 'https://' + job.companyDomain : job.url} target="_blank" rel="noopener noreferrer">
            <CompanyAvatar job={job} size="sm" /><span><HighlightText text={job.company} query={query} />{detail && job.batch && <small>{job.batch}</small>}</span>
          </a></td>
          <td className="location-cell"><HighlightText text={job.location || 'Location unavailable'} query={query} />{job.isRemote && <span className="remote-label">Remote</span>}</td>
          <td className="date-cell">{job.postedAt ? <><span>{job.dateKind === 'updated' ? 'Updated' : job.dateKind === 'created' ? 'Created' : 'Posted'}</span> <time dateTime={job.postedAt}>{dateFormat.format(new Date(job.postedAt))}</time></> : 'Date unavailable'}</td>
          <td className="action-cell"><div>
            {detail && <button type="button" aria-label={'Copy link to ' + job.title} onClick={() => copy(job)}>{copiedId === job.id ? <Check size={15} /> : <Copy size={15} />}</button>}
            <button type="button" aria-label={'Save ' + job.title + ' at ' + job.company} aria-pressed={saved.has(job.id)} onClick={() => toggleSaved(job)}>
              {saved.has(job.id) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
            </button>
            <a href={job.url} target="_blank" rel="noopener noreferrer" aria-label={'Apply for ' + job.title + ' at ' + job.company}>Apply <ArrowUpRight size={14} /></a>
          </div></td>
        </tr>)}</tbody>
      </table> : <div className="board-empty">
        <h3>{emptySaved ? 'No saved roles yet' : scope === 'Saved' ? 'No saved roles match your filters' : 'No matching roles'}</h3>
        <p>{emptySaved ? 'Use the bookmark beside a role to keep it here.' : 'Try another search or clear your filters.'}</p>
        <button className="board-control" onClick={() => { resetFilters(); if (emptySaved || !hasFilters) setScope('All roles'); }}>{emptySaved || !hasFilters ? 'Browse all roles' : 'Clear filters'}</button>
      </div>}
      {pages > 1 && <nav className="board-pages" aria-label="Results pages">
        {mobile ? <>
          {firstPage > 0 && <button onClick={() => goToPage(firstPage - 1)}>Previous</button>}
          {current < pages - 1 && <button onClick={() => setRange({ first: firstPage, last: current + 1 })}>Load more</button>}
        </> : <>
          <button disabled={!firstPage} onClick={() => goToPage(firstPage - 1)}>Previous</button>
          {Array.from({ length: Math.min(5, pages) }, (_, i) => Math.max(0, Math.min(current - 2, pages - 5)) + i).map(index =>
            <button key={index} aria-label={'Page ' + (index + 1)} aria-current={current === index ? 'page' : undefined} onClick={() => goToPage(index)}>{index + 1}</button>)}
          <button disabled={current >= pages - 1} onClick={() => goToPage(current + 1)}>Next</button>
        </>}
      </nav>}
      <p className="sr-only" role="status">{message}</p>
    </div>
  );
}
