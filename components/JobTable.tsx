'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Bookmark, BookmarkCheck, Check, Copy, Globe2, List, Rows3, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Job, AtsSource } from '@/types/job';

const PAGE_SIZE = 50;
const SAVED_KEY = 'design-jobs:saved';
const MODE_KEY = 'design-jobs:view-mode';
const sources: Record<AtsSource, string> = {
  yc: 'Y Combinator', ashby: 'Ashby', greenhouse: 'Greenhouse', lever: 'Lever', remotive: 'Remotive', workday: 'Workday',
};
const portalColors: Record<AtsSource, string> = {
  yc: 'bg-orange-100 text-orange-900 dark:bg-orange-400/15 dark:text-orange-200',
  ashby: 'bg-violet-100 text-violet-900 dark:bg-violet-400/15 dark:text-violet-200',
  greenhouse: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200',
  lever: 'bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200',
  remotive: 'bg-rose-100 text-rose-900 dark:bg-rose-400/15 dark:text-rose-200',
  workday: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
};

function listingSources(job: Job): AtsSource[] {
  return job.sources?.length ? job.sources : [job.ats];
}

function JobLocation({ job, query }: { job: Job; query: string }) {
  const raw = job.location.trim();
  // Preserve mixed arrangements such as “Remote or in-office in San Francisco”.
  const location = job.isRemote
    ? raw.replace(/^[Rr]emote(?: [Ll]ocation)?(?:\s*[-–—,:|]\s*|\s+(?=[A-Z(])|$)/, '')
        .replace(/^\(([^()]+)\)$/, '$1').trim()
    : raw;
  return (
    <div className="listing-location">
      {job.isRemote && <span className="remote-label"><Globe2 size={13} aria-hidden="true" />Remote</span>}
      {location ? <span><HighlightText text={location} query={query} /></span> : !job.isRemote && 'Location unavailable'}
    </div>
  );
}

const columns = { title: 'Role', company: 'Company', location: 'Location', postedAt: 'Listing date' };
type SortKey = keyof typeof columns;
type Scope = 'All roles' | 'AI companies' | 'Saved';
const scopes: Scope[] = ['All roles', 'AI companies', 'Saved'];
const mobileQuery = '(max-width: 679px)';
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
      <mark key={`${index}-${target}`} className="radius-chip bg-[hsl(var(--accent-lime)/0.28)] text-inherit">
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
const shortDateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function ListingDate({ job, currentYear }: { job: Job; currentYear: number }) {
  if (!job.postedAt) return <>Date unavailable</>;
  const date = new Date(job.postedAt);
  const full = dateFormat.format(date);
  const label = job.dateKind === 'updated' ? 'Updated' : job.dateKind === 'created' ? 'Created' : 'Posted';
  return (
    <>
      <span>{label}</span>{' '}
      <time dateTime={job.postedAt} title={full} aria-label={full}>
        {date.getUTCFullYear() === currentYear ? shortDateFormat.format(date) : full}
      </time>
    </>
  );
}


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
  const [notice, setNotice] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const noticeTrigger = useRef<HTMLElement | null>(null);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const emptyAction = useRef<HTMLButtonElement>(null);
  const firstNewRow = useRef<string | null>(null);
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

  function toggleSaved(job: Job, trigger: HTMLButtonElement) {
    let ids = new Set(saved);
    if (!storageUnavailable.current) {
      try { ids = readSaved(); } catch { /* Use the session copy. */ }
    }
    const adding = !ids.has(job.id);
    if (adding) ids.add(job.id);
    else ids.delete(job.id);
    if (!adding && scope === 'Saved') {
      const row = trigger.closest('tr');
      const adjacent = row?.nextElementSibling ?? row?.previousElementSibling;
      const nextButton = adjacent?.querySelector<HTMLButtonElement>('.save-job');
      if (nextButton) nextButton.focus();
      else requestAnimationFrame(() => (emptyAction.current ?? results.current)?.focus());
    }
    setSaved(ids);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(ids)));
      setMessage((adding ? 'Saved ' : 'Removed ') + job.title);
    } catch {
      storageUnavailable.current = true;
      noticeTrigger.current = trigger;
      setNotice('Saved roles will last for this visit. Browser storage is unavailable.');
    }
  }

  function toggleDetail() {
    setDetail(!detail);
    try { localStorage.setItem(MODE_KEY, detail ? 'compact' : 'detail'); }
    catch { /* The view still changes for this visit. */ }
  }

  function resetFilters() {
    setSearch(''); setRemote(false); setWeek(false); setSource('all'); setPage(0);
    input.current?.focus();
  }

  function sortBy(key: SortKey, asc = sortKey === key ? !ascending : key !== 'postedAt') {
    setSortKey(key); setAscending(asc); setPage(0);
  }

  const overview = useMemo(() => ({
    companies: new Set(jobs.map(job => job.company)).size,
    remote: jobs.filter(job => job.isRemote).length,
  }), [jobs]);

  const savedCount = jobs.filter(job => saved.has(job.id)).length;
  const matches = useMemo(() => {
    const filtered = jobs.filter(job => {
      if (scope === 'Saved' && !saved.has(job.id)) return false;
      if (scope === 'AI companies' && !job.isAI) return false;
      if (remote && !job.isRemote) return false;
      if (source !== 'all' && !listingSources(job).some(value => value === source)) return false;
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
  const snapshotYear = new Date(fetchedAt).getUTCFullYear();
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

  useEffect(() => {
    if (!firstNewRow.current) return;
    document.getElementById(firstNewRow.current)?.focus({ preventScroll: true });
    firstNewRow.current = null;
  }, [range]);

  async function copy(job: Job, trigger: HTMLButtonElement) {
    try {
      await navigator.clipboard.writeText(job.url);
      setCopiedId(job.id);
      setMessage('Copied link to ' + job.title);
    } catch {
      noticeTrigger.current = trigger;
      setNotice('Could not copy the link. Open the listing from its title.');
    }
  }

  return (
    <div className="job-board">
      <div className="board-width browse-tools">
        <div className="directory-intro">
          <p><strong>Product, UX, brand and motion roles</strong> <span className="text-unit">at {overview.companies} companies.</span></p>
          <div className="board-summary">
            <span>{overview.remote} remote roles</span>
            <span>Last checked <time dateTime={new Date(fetchedAt).toISOString()}>{checked} IST</time></span>
          </div>
        </div>
        <div className="board-toolbar">
          <div className="board-search">
            <Search size={20} aria-hidden="true" />
            <input ref={input} type="search" aria-label="Search jobs by role, company or location" placeholder="Role, company or location"
              value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
            {search ? <button type="button" aria-label="Clear search" onClick={() => { setSearch(''); setPage(0); input.current?.focus(); }}><X size={17} /></button> : <kbd aria-hidden="true">/</kbd>}
          </div>
          <div className="board-options">
            <label className="board-control"><input type="checkbox" checked={remote} onChange={e => { setRemote(e.target.checked); setPage(0); }} />Remote only</label>
            <button type="button" className="board-control" ref={filterTrigger} aria-expanded={filtersOpen} aria-controls="board-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
              <SlidersHorizontal size={15} />Filters{(week || source !== 'all') && <Check size={14} />}
            </button>
            <button type="button" className="board-control" title="Show job details" aria-pressed={detail} onClick={toggleDetail}>
              {detail ? <List size={16} /> : <Rows3 size={16} />} Details
            </button>
          </div>
        </div>
        <div id="board-filters" className="board-filters" hidden={!filtersOpen} onKeyDown={event => {
          if (event.key === 'Escape') {
            setFiltersOpen(false);
            filterTrigger.current?.focus();
          }
        }}>
          <label>Job portal<select value={source} onChange={e => { setSource(e.target.value); setPage(0); }}>
            <option value="all">All portals</option>{Object.entries(sources).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>
          <label>Sort by<select value={sortKey + (ascending ? '+' : '-')} onChange={e => sortBy(e.target.value.slice(0, -1) as SortKey, e.target.value.endsWith('+'))}>
            {Object.entries(columns).flatMap(([id, name]) => ['+', '-'].map(dir =>
              <option key={id + dir} value={id + dir}>{id === 'postedAt' ? (dir === '+' ? 'Oldest first' : 'Newest first') : name + (dir === '+' ? ' A–Z' : ' Z–A')}</option>))}
          </select></label>
          <label className="board-control"><input type="checkbox" checked={week} onChange={e => { setWeek(e.target.checked); setPage(0); }} />Posted in the last 7 days</label>
        </div>
      </div>
      <div className="directory-results">
        <div className="board-width">
          <div className="results-nav">
            <div className="board-scopes" role="group" aria-label="Browse roles">
              {scopes.map(item => <button type="button" key={item} aria-pressed={scope === item}
                onClick={() => { setScope(item); setPage(0); }}>
                {item === 'Saved' && <Bookmark size={14} aria-hidden="true" />}
                {item}{item === 'Saved' && <span> ({savedCount})</span>}
              </button>)}
            </div>
            <div className="results-summary">
              {source !== 'all' && <span className="active-portal">{sources[source as AtsSource]}</span>}
              <h2 tabIndex={-1} ref={results} aria-live="polite" aria-atomic="true">
                {matches.length ? (start + 1) + '–' + end + ' of ' + matches.length + ' roles' : '0 matching roles'}
              </h2>
              {hasFilters && matches.length > 0 && <button type="button" onClick={resetFilters}>Clear filters</button>}
            </div>
          </div>
          {visible.length ? <table className="listings-table" aria-label="Design job listings">
            <thead><tr>{(Object.keys(columns) as SortKey[]).map(key => <th key={key} scope="col" aria-sort={key === sortKey ? (ascending ? 'ascending' : 'descending') : undefined}>
              <button type="button" onClick={() => sortBy(key)}>{columns[key]}{key === sortKey && (ascending ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}</button>
            </th>)}
              <th scope="col" className="portal-heading">Job portal</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>{visible.map(job => <tr key={job.id}>
              <td className="role-cell">
                <a id={'listing-' + job.id} href={job.url} target="_blank" rel="noopener noreferrer" className="role-title"><HighlightText text={job.title} query={query} /></a>
                {detail && job.department && <div className="role-detail">{job.department}</div>}
              </td>
              <td className="company-cell"><a href={job.companyDomain ? 'https://' + job.companyDomain : job.url} target="_blank" rel="noopener noreferrer">
                <CompanyAvatar job={job} size="sm" /><span><HighlightText text={job.company} query={query} />{detail && job.batch && <small>{job.batch}</small>}</span>
              </a></td>
              <td className="location-cell">
                <JobLocation job={job} query={query} />
              </td>
              <td className="date-cell"><ListingDate job={job} currentYear={snapshotYear} /></td>
              <td className="portal-cell">
                <div className="listing-portals" role="group" aria-label="Job portals">
                  <span className="portal-caption">Via</span>
                  {listingSources(job).map(id => (
                    <span key={id} className={'portal-badge ' + portalColors[id]}>{sources[id]}</span>
                  ))}
                </div>
              </td>
              <td className="action-cell"><div>
                {detail && <button type="button" title={copiedId === job.id ? 'Link copied' : 'Copy job link'} aria-label={'Copy link to ' + job.title} onClick={event => copy(job, event.currentTarget)}>{copiedId === job.id ? <Check size={15} /> : <Copy size={15} />}</button>}
                <button type="button" className="save-job" title={saved.has(job.id) ? 'Remove from saved roles' : 'Save role'} aria-label={'Save ' + job.title + ' at ' + job.company} aria-pressed={saved.has(job.id)} onClick={event => toggleSaved(job, event.currentTarget)}>
                  {saved.has(job.id) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                </button>
                <a href={job.url} target="_blank" rel="noopener noreferrer" aria-label={'Apply for ' + job.title + ' at ' + job.company}>Apply <ArrowUpRight size={14} aria-hidden="true" /></a>
              </div></td>
            </tr>)}</tbody>
          </table> : <div className="board-empty">
            <h3>{emptySaved ? 'No saved roles yet' : scope === 'Saved' ? 'No saved roles match your filters' : 'No matching roles'}</h3>
            <p>{emptySaved ? 'Use the bookmark beside a role to keep it here.' : 'Try another search or clear your filters.'}</p>
            <button ref={emptyAction} className="board-control" onClick={() => { resetFilters(); if (emptySaved || !hasFilters) setScope('All roles'); }}>{emptySaved || !hasFilters ? 'Browse all roles' : 'Clear filters'}</button>
          </div>}
          {pages > 1 && <nav className="board-pages" aria-label="Results pages">
            {mobile ? <>
              {firstPage > 0 && <button onClick={() => goToPage(firstPage - 1)}>Previous</button>}
              {current < pages - 1 && <button onClick={() => {
                firstNewRow.current = 'listing-' + matches[end].id;
                setRange({ first: firstPage, last: current + 1 });
              }}>Load more</button>}
            </> : <>
              <button disabled={!firstPage} onClick={() => goToPage(firstPage - 1)}>Previous</button>
              {Array.from({ length: Math.min(5, pages) }, (_, i) => Math.max(0, Math.min(current - 2, pages - 5)) + i).map(index =>
                <button key={index} aria-label={'Page ' + (index + 1)} aria-current={current === index ? 'page' : undefined} onClick={() => goToPage(index)}>{index + 1}</button>)}
              <button disabled={current >= pages - 1} onClick={() => goToPage(current + 1)}>Next</button>
            </>}
          </nav>}
        </div>
      </div>
      <p className="sr-only" role="status">{message}</p>
      {notice && <div className="board-notice"><span role="status">{notice}</span><button type="button" aria-label="Dismiss notice" onClick={() => {
        setNotice('');
        (noticeTrigger.current?.isConnected ? noticeTrigger.current : input.current)?.focus();
      }}><X size={16} /></button></div>}
    </div>
  );
}
