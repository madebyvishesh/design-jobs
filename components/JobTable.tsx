'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Bookmark, BookmarkCheck, Check, ChevronDown, Copy, Globe2, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { columns, sources, scopes, readBrowseParams, writeBrowseParams, type SortKey, type Scope, type BrowseCriteria } from '@/lib/browseParams';
import { searchTerms, indexJob, jobMatches, highlightWords } from '@/lib/jobSearch';
import companyLogos from '@/lib/companyLogos.json';
import BoardHeader from './BoardHeader';
import type { Job, AtsSource } from '@/types/job';

const PAGE_SIZE = 50;
const SAVED_KEY = 'design-jobs:saved';
const MODE_KEY = 'design-jobs:view-mode';
function listingSources(job: Job): AtsSource[] {
  return job.sources?.length ? job.sources : [job.ats];
}

function JobLocation({ job, terms }: { job: Job; terms: string[] }) {
  const raw = job.location.trim();
  // Preserve mixed arrangements such as “Remote or in-office in San Francisco”.
  const location = job.isRemote
    ? raw.replace(/^[Rr]emote(?: [Ll]ocation)?(?:\s*[-–—,:|]\s*|\s+(?=[A-Z(])|$)/, '')
        .replace(/^\(([^()]+)\)$/, '$1').trim()
    : raw;
  return (
    <div className="listing-location">
      {job.isRemote && <span className="remote-label"><Globe2 size={13} aria-hidden="true" />Remote</span>}
      {location ? <span>{!job.isRemote && <MapPin size={12} className="place-pin" aria-hidden="true" />}<HighlightText text={location} terms={terms} /></span> : !job.isRemote && 'Location unavailable'}
    </div>
  );
}

function sortLabel(key: SortKey, ascending: boolean) {
  if (key === 'postedAt') return ascending ? 'Oldest first' : 'Newest first';
  return columns[key] + (ascending ? ' A–Z' : ' Z–A');
}

function readSaved() {
  const ids: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
  return new Set<string>(Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []);
}

function HighlightText({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  return <>{highlightWords(text || '', terms).map((part, index) =>
    part.matched ? <mark key={index} className="search-match">{part.value}</mark> : part.value
  )}</>;
}

const localLogos: Record<string, string> = companyLogos;

function CompanyAvatar({ job }: { job: Job }) {
  const local = localLogos[job.companyDomain?.toLowerCase() || job.logoUrl || ''];
  const candidates = [
    local && '/company-logos/' + local,
    job.logoUrl,
    job.companyDomain && 'https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(job.companyDomain),
  ].filter(Boolean);
  const [attempt, setAttempt] = useState(0);
  const src = candidates[attempt];
  return (
    <span className="company-avatar" aria-hidden="true">
      {job.company.charAt(0).toUpperCase()}
      {src && <img key={src} src={src} width={24} height={24} alt="" loading="lazy" decoding="async"
        onError={() => setAttempt(attempt + 1)} />}
    </span>
  );
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ListingDate({ job, currentYear }: { job: Job; currentYear: number }) {
  if (!job.postedAt) return <>Date unavailable</>;
  const date = new Date(job.postedAt);
  const short = date.getUTCDate() + ' ' + months[date.getUTCMonth()];
  const full = short + ' ' + date.getUTCFullYear();
  const label = job.dateKind === 'updated' ? 'Updated' : job.dateKind === 'created' ? 'Created' : 'Posted';
  return (
    <>
      <span>{label}</span>{' '}
      <time dateTime={job.postedAt} title={full} aria-label={full}>
        {date.getUTCFullYear() === currentYear ? short : full}
      </time>
    </>
  );
}


interface Props {
  jobs: Job[];
  fetchedAt: number;
  checked: string;
  initial: BrowseCriteria;
}

export default function JobTable({ jobs, fetchedAt, checked, initial }: Props) {
  const [scope, setScope] = useState<Scope>(initial.scope);
  const [search, setSearch] = useState(initial.search);
  const [remote, setRemote] = useState(initial.remote);
  const [week, setWeek] = useState(initial.week);
  const [source, setSource] = useState(initial.source);
  const [sortKey, setSortKey] = useState<SortKey>(initial.sortKey);
  const [ascending, setAscending] = useState(initial.ascending);
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
  const mobilePager = useRef<HTMLDivElement>(null);
  const rowGroup = useRef<HTMLDivElement>(null);
  const restoreRow = useRef<{ id: string; top: number } | null>(null);
  const firstNewRow = useRef<string | null>(null);
  const results = useRef<HTMLHeadingElement>(null);
  const terms = useMemo(() => searchTerms(search), [search]);
  const indexed = useMemo(() => jobs.map(job => ({ job, index: indexJob(job) })), [jobs]);

  useEffect(() => {
    function restore() {
      const state = readBrowseParams(new URL(window.location.href).searchParams);
      setSearch(state.search); setScope(state.scope); setRemote(state.remote); setWeek(state.week);
      setSource(state.source); setSortKey(state.sortKey); setAscending(state.ascending); setPage(0);
    }
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  useEffect(() => {
    let retry: number | undefined;
    function persist() {
      const url = new URL(window.location.href);
      writeBrowseParams(url.searchParams, { search, scope, remote, week, source, sortKey, ascending });
      if (url.href === window.location.href) return;
      try { window.history.replaceState(null, '', url); }
      catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'SecurityError') throw error;
        // Some browsers rate-limit history updates during rapid typing.
        window.clearTimeout(retry);
        retry = window.setTimeout(persist, 1000);
      }
    }
    persist();
    return () => window.clearTimeout(retry);
  }, [search, scope, remote, week, source, sortKey, ascending]);

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
      const row = trigger.closest('.listing-row');
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

  const savedCount = jobs.filter(job => saved.has(job.id)).length;
  const { matches, closeTitles } = useMemo(() => {
    const candidates = indexed.filter(({ job }) => {
      if (scope === 'Saved' && !saved.has(job.id)) return false;
      if (scope === 'AI companies' && !job.isAI) return false;
      if (remote && !job.isRemote) return false;
      if (source !== 'all' && !listingSources(job).some(value => value === source)) return false;
      if (week) {
        const age = fetchedAt - Date.parse(job.postedAt);
        if (job.dateKind !== 'posted' || !(age >= 0 && age <= 7 * 86400000)) return false;
      }
      return true;
    });
    let hits = search.trim() && !terms.length ? [] : candidates.filter(({ index }) => jobMatches(index, terms));
    const exactCount = hits.length;
    if (!exactCount && terms.some(term => term.length >= 5)) {
      hits = candidates.filter(({ index }) => jobMatches(index, terms, true));
    }
    const matches = hits.map(({ job }) => job).sort((a, b) => {
      if (sortKey === 'postedAt' && Boolean(a.postedAt) !== Boolean(b.postedAt)) return a.postedAt ? -1 : 1;
      const left = a[sortKey].toLowerCase();
      const right = b[sortKey].toLowerCase();
      const order = left < right ? -1 : left > right ? 1 : 0;
      return ascending ? order : -order;
    });
    return { matches, closeTitles: !exactCount && matches.length > 0 };
  }, [indexed, scope, saved, remote, source, week, fetchedAt, search, terms, sortKey, ascending]);
  const overview = useMemo(() => ({
    companies: new Set(matches.map(job => job.company)).size,
    remote: matches.filter(job => job.isRemote).length,
  }), [matches]);

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

  useEffect(() => {
    const anchor = restoreRow.current;
    if (anchor) {
      restoreRow.current = null;
      const row = document.getElementById(anchor.id)?.closest('.listing-row');
      if (row) window.scrollBy(0, row.getBoundingClientRect().top - anchor.top);
    }
    if (firstPage === current) return;
    const mobile = window.matchMedia('(max-width: 679px)');
    let page = current;
    let position: { id: string; top: number } | null = null;
    function rememberPosition() {
      // WebKit can dispatch a resize-induced scroll before the media query change event.
      if (!mobilePager.current?.getClientRects().length || !rowGroup.current) return;
      const rows = rowGroup.current.children;
      const focused = document.activeElement?.closest('.listing-row');
      const bounds = focused?.getBoundingClientRect();
      let index = bounds && bounds.top >= 0 && bounds.top < innerHeight
        ? Array.prototype.indexOf.call(rows, focused) : -1;
      if (index < 0) {
        let low = 0, high = rows.length;
        while (low < high) {
          const mid = Math.floor((low + high) / 2);
          if (rows[mid].getBoundingClientRect().bottom <= 0) low = mid + 1;
          else high = mid;
        }
        index = low;
      }
      const row = rows[index];
      const top = row?.getBoundingClientRect().top;
      const title = row?.querySelector('.role-title');
      position = title && top !== undefined && top < innerHeight ? { id: title.id, top } : null;
      page = Math.min(current, firstPage + Math.floor(index / PAGE_SIZE));
    }
    function changeLayout() {
      if (mobile.matches) return;
      restoreRow.current = position;
      setPage(page);
    }
    rememberPosition();
    if (!mobile.matches) changeLayout();
    mobile.addEventListener('change', changeLayout);
    window.addEventListener('scroll', rememberPosition, { passive: true });
    return () => {
      mobile.removeEventListener('change', changeLayout);
      window.removeEventListener('scroll', rememberPosition);
    };
  }, [firstPage, current]);

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

  const checkedTime = <time dateTime={new Date(fetchedAt).toISOString()}>{checked} IST</time>;
  const customSort = sortKey !== 'postedAt' || ascending;
  return (
    <div className="job-board">
      <BoardHeader>
        <div className="board-toolbar">
          <div className="board-search">
            <Search size={20} aria-hidden="true" />
            <input ref={input} id="job-search" type="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label="Search jobs by role, company or location" placeholder="Search jobs"
              value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
            {search ? <button type="button" aria-label="Clear search" onClick={() => { setSearch(''); setPage(0); input.current?.focus(); }}><X size={17} /></button> : <kbd aria-hidden="true">/</kbd>}
          </div>
          <div className="board-options">
            <button type="button" className="board-control" ref={filterTrigger} aria-label={week || source !== 'all' ? `Filters, ${Number(week) + Number(source !== 'all')} active` : 'Filters'} aria-expanded={filtersOpen} title="Filters" aria-controls="board-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
              <SlidersHorizontal size={16} aria-hidden="true" /><span className="filter-label">Filters</span>{(week || source !== 'all') && <span className="filter-count" aria-hidden="true">{Number(week) + Number(source !== 'all')}</span>}
            </button>
          </div>
        </div>
        <div id="board-filters" className="board-filters" hidden={!filtersOpen} onKeyDown={event => {
          if (event.key === 'Escape') {
            setFiltersOpen(false);
            filterTrigger.current?.focus();
          }
        }}>
          <div className="filter-field">
            <label htmlFor="portal-filter">Job portal</label>
            <div className="filter-select">
              <select id="portal-filter" onKeyDown={event => {
                if (event.key === 'Tab' && event.shiftKey) {
                  event.preventDefault();
                  filterTrigger.current?.focus();
                }
              }} value={source} onChange={e => { setSource(e.target.value); setPage(0); }}>
                <option value="all">All portals</option>
                {Object.entries(sources).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </div>
          </div>
          <div className="filter-field">
            <label htmlFor="sort-order">Sort by</label>
            <div className="filter-select">
              <select id="sort-order" value={sortKey + (ascending ? '+' : '-')} onChange={e => sortBy(e.target.value.slice(0, -1) as SortKey, e.target.value.endsWith('+'))}>
                {Object.keys(columns).flatMap(id => ['+', '-'].map(dir =>
                  <option key={id + dir} value={id + dir}>{sortLabel(id as SortKey, dir === '+')}</option>))}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </div>
          </div>
          <label className="board-control"><input type="checkbox" checked={week} onChange={e => { setWeek(e.target.checked); setPage(0); }} />Posted in the last 7 days</label>
          <label className="board-control"><input type="checkbox" checked={detail} onChange={toggleDetail} />Show job details</label>
        </div>
      </BoardHeader>
      <main id="jobs" className="board-main">
        <div className="directory-results">
          <div className="board-width">
            <div className="results-nav">
              <div className="browse-nav">
                <div className="board-scopes" role="group" aria-label="Browse roles">
                  {scopes.map(item => <button type="button" key={item} aria-pressed={scope === item}
                    onClick={() => { setScope(item); setPage(0); }}>
                    {item}{item === 'Saved' && savedCount > 0 && <span> ({savedCount})</span>}
                  </button>)}
                </div>
                <label className="board-control remote-control"><input type="checkbox" checked={remote} onChange={e => { setRemote(e.target.checked); setPage(0); }} aria-label="Remote only" />Remote</label>
              </div>
              <div className="results-summary">
                <h2 tabIndex={-1} ref={results} aria-live="polite" aria-atomic="true">
                  <span>{matches.length ? (start + 1) + '–' + end + ' of ' + matches.length + (matches.length === 1 ? ' role' : ' roles') : '0 matching roles'}</span>
                  {matches.length > 0 && <>
                    <span>{overview.companies} {overview.companies === 1 ? 'company' : 'companies'}</span>
                    <span>{overview.remote} remote</span>
                  </>}
                </h2>
                {closeTitles && <span role="status">Including close title matches</span>}
                {customSort && <span className="sort-summary">{sortLabel(sortKey, ascending)}</span>}
                {source !== 'all' && <button type="button" className="filter-chip" aria-label={'Remove ' + sources[source as AtsSource] + ' filter'}
                  onClick={() => { setSource('all'); setPage(0); filterTrigger.current?.focus(); }}>{sources[source as AtsSource]} <X size={12} /></button>}
                {week && <button type="button" className="filter-chip" aria-label="Remove last 7 days filter"
                  onClick={() => { setWeek(false); setPage(0); filterTrigger.current?.focus(); }}>Last 7 days <X size={12} /></button>}
              </div>
            </div>
            {visible.length ? <div className="listings-table" data-details={detail} role="table" aria-label="Design job listings">
              <div className="listing-head" role="row">
                {(Object.keys(columns) as SortKey[]).map(key => <div key={key} role="columnheader" aria-sort={key === sortKey ? (ascending ? 'ascending' : 'descending') : undefined}>
                  <button type="button" onClick={() => sortBy(key)}>{columns[key]}{key === sortKey && (ascending ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />)}</button>
                  <span className="compact-column-name">{columns[key]}</span>
                </div>)}
                {detail && <div role="columnheader">Job portal</div>}
                <div role="columnheader"><span className="sr-only">Actions</span></div>
              </div>
              <div className="tablet-guide" aria-hidden="true">
                <span>Role and company</span><span>Location and date</span>
              </div>
              <div role="rowgroup" ref={rowGroup}>{visible.map(job => <div className="listing-row" role="row" key={job.id}>
                <div role="cell" className="role-cell">
                  <a id={'listing-' + job.id} href={job.url} target="_blank" rel="noopener noreferrer" className="role-title"><span><HighlightText text={job.title} terms={terms} /><span className="title-arrow" aria-hidden="true">{'\u2060'}<ArrowUpRight size={13} /></span></span></a>
                  {detail && job.department && <div className="role-detail">{job.department}</div>}
                </div>
                <div role="cell" className="company-cell"><a href={job.companyDomain ? 'https://' + job.companyDomain : job.url} target="_blank" rel="noopener noreferrer">
                  <CompanyAvatar key={job.logoUrl || job.companyDomain} job={job} /><span><HighlightText text={job.company} terms={terms} />{detail && job.batch && <small>{job.batch}</small>}</span>
                </a>{detail && job.department && <span className="compact-department">{job.department}</span>}</div>
                <div className="listing-place" role="presentation">
                  <div role="cell" className="location-cell"><JobLocation job={job} terms={terms} /></div>
                  <div className="listing-attribution" role="presentation">
                    <div role="cell" className="date-cell"><ListingDate job={job} currentYear={snapshotYear} /></div>
                    {detail && <div role="cell" className="portal-cell">
                      <div className="listing-portals" role="group" aria-label="Job portals">
                        <span className="portal-caption">Via</span>
                        {listingSources(job).map(id => (
                          <span key={id} data-portal={id} className="portal-badge">{sources[id]}</span>
                        ))}
                      </div>
                    </div>}
                  </div>
                </div>
                <div role="cell" className="action-cell"><div>
                  <button type="button" className="save-job" title={saved.has(job.id) ? 'Remove from saved roles' : 'Save role'} aria-label={'Save ' + job.title + ' at ' + job.company} aria-pressed={saved.has(job.id)} onClick={event => toggleSaved(job, event.currentTarget)}>
                    {saved.has(job.id) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                  </button>
                  {detail && <button type="button" className="copy-job" title={copiedId === job.id ? 'Link copied' : 'Copy job link'} aria-label={'Copy link to ' + job.title} onClick={event => copy(job, event.currentTarget)}>{copiedId === job.id ? <Check size={15} /> : <Copy size={15} />}</button>}
                  <a href={job.url} target="_blank" rel="noopener noreferrer" aria-label={'Apply for ' + job.title + ' at ' + job.company}><span className="apply-label">Apply <ArrowUpRight size={14} aria-hidden="true" /></span></a>
                </div></div>
              </div>)}</div>
            </div> : <div className="board-empty">
              <span className="empty-icon" aria-hidden="true">{emptySaved ? <Bookmark size={22} /> : <Search size={22} />}</span>
              <h3>{emptySaved ? 'No saved roles yet' : scope === 'Saved' ? 'No saved roles match your filters' : 'No matching roles'}</h3>
              <p>{emptySaved ? 'Use the bookmark beside a role to keep it here.' : 'Try another search or clear your filters.'}</p>
              <button ref={emptyAction} className="board-control" onClick={() => { resetFilters(); if (emptySaved || !hasFilters) setScope('All roles'); }}>{emptySaved || !hasFilters ? 'Browse all roles' : 'Clear filters'}</button>
            </div>}
            {pages > 1 && <nav className="board-pages" aria-label="Results pages">
              <div className="pages-mobile" ref={mobilePager}>
                {firstPage > 0 && <button onClick={() => goToPage(firstPage - 1)}>Previous</button>}
                {current < pages - 1 && <button onClick={() => {
                  firstNewRow.current = 'listing-' + matches[end].id;
                  setRange({ first: firstPage, last: current + 1 });
                }}>Load more</button>}
              </div>
              <div className="pages-desktop">
                <button disabled={!firstPage} onClick={() => goToPage(firstPage - 1)}>Previous</button>
                {Array.from({ length: Math.min(5, pages) }, (_, i) => Math.max(0, Math.min(current - 2, pages - 5)) + i).map(index =>
                  <button key={index} aria-label={'Page ' + (index + 1)} aria-current={current === index ? 'page' : undefined} onClick={() => goToPage(index)}>{index + 1}</button>)}
                <button disabled={current >= pages - 1} onClick={() => goToPage(current + 1)}>Next</button>
              </div>
            </nav>}
          </div>
        </div>
      </main>
      <footer className="board-footer board-width">
        <span>Last checked {checkedTime}</span>
        <a href="#job-search" onClick={event => { event.preventDefault(); input.current?.focus(); input.current?.scrollIntoView({ block: 'center' }); }}>Back to search <ArrowUp size={14} aria-hidden="true" /></a>
      </footer>
      <p className="sr-only" role="status">{message}</p>
      {notice && <div className="board-notice"><span role="status">{notice}</span><button type="button" aria-label="Dismiss notice" onClick={() => {
        setNotice('');
        (noticeTrigger.current?.isConnected ? noticeTrigger.current : input.current)?.focus();
      }}><X size={16} /></button></div>}
    </div>
  );
}
