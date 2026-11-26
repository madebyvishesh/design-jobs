'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Bookmark, BookmarkCheck, Check, ChevronDown, Copy, Globe2, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { columns, sources, scopes, readBrowseParams, writeBrowseParams, type SortKey, type Scope, type BrowseCriteria } from '@/lib/browseParams';
import { listingKnownSince } from '@/lib/listingAge';
import { remoteLocation } from '@/lib/remoteLocation';
import { countries, levels, experienceLevel, remoteEligibility } from '@/lib/discoveryFilters';
import { useHiddenRoles } from './useHiddenRoles';
import FieldPicker from './FieldPicker';
import ListingHint from './ListingHint';
import { fields, jobFields, type DesignField } from '@/lib/jobFields';
import { usePreviousVisit, useShortlist } from './useShortlist';
import BoardSelect from './BoardSelect';
import SavedSearches from './SavedSearches';
import { searchTerms, indexJob, jobMatches, highlightWords, titleRelevance } from '@/lib/jobSearch';
import companyLogos from '@/lib/companyLogos.json';
import BoardHeader from './BoardHeader';
import type { Job, AtsSource } from '@/types/job';

const PAGE_SIZE = 50;
const MODE_KEY = 'design-jobs:view-mode';
function listingSources(job: Job): AtsSource[] {
  return job.sources?.length ? job.sources : [job.ats];
}

function JobLocation({ job, terms }: { job: Job; terms: string[] }) {
  const place = useRef<HTMLSpanElement>(null);
  const raw = job.location.trim();
  const location = job.isRemote ? remoteLocation(raw) : raw;
  useEffect(() => {
    const text = place.current;
    if (!text) return;
    function update() {
      if (text) text.tabIndex = text.scrollWidth > text.clientWidth ? 0 : -1;
    }
    const observer = new ResizeObserver(update);
    update();
    observer.observe(text);
    return () => observer.disconnect();
  }, [location, terms]);
  return (
    <span className="listing-location">
      {job.isRemote && <span className="remote-label"><Globe2 size={13} aria-hidden="true" />Remote</span>}
      {location ? <span className="place-text" ref={place} data-full-text={raw} tabIndex={-1}>{!job.isRemote && <MapPin size={12} className="place-pin" aria-hidden="true" />}<HighlightText text={location} terms={terms} /></span> : !job.isRemote && 'Location unavailable'}
    </span>
  );
}

function sortLabel(key: SortKey, ascending: boolean) {
  if (key === 'postedAt') return ascending ? 'Oldest first' : 'Newest first';
  return columns[key] + (ascending ? ' A–Z' : ' Z–A');
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
        ref={image => {
          if (!image?.complete) return;
          if (image.naturalWidth) image.dataset.ready = '';
          else setAttempt(attempt + 1);
        }}
        onLoad={event => { event.currentTarget.dataset.ready = ''; }}
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
  cutoff: number;
  expiredIds: string[];
  jobs: Job[];
  fetchedAt: number;
  checked: string;
  initial: BrowseCriteria;
}

export default function JobTable({ jobs, cutoff, expiredIds, fetchedAt, checked, initial }: Props) {
  const [scope, setScope] = useState<Scope>(initial.scope);
  const [search, setSearch] = useState(initial.search);
  const [remote, setRemote] = useState(initial.remote);
  const [week, setWeek] = useState(initial.week);
  const [source, setSource] = useState(initial.source);
  const [sortKey, setSortKey] = useState<SortKey>(initial.sortKey);
  const [ascending, setAscending] = useState(initial.ascending);
  const [field, setField] = useState(initial.field);
  const [company,setCompany] = useState(initial.company);
  const [level,setLevel] = useState(initial.level);
  const [salary,setSalary] = useState(initial.salary);
  const [country,setCountry] = useState(initial.country);
  const [unspecified,setUnspecified] = useState(initial.unspecified);
  const [showHidden,setShowHidden] = useState(false);
  const { hidden,setRoleHidden } = useHiddenRoles();
  const hiddenIds = useMemo(()=>new Set(hidden),[hidden]);
  const [undoId,setUndoId] = useState('');
  const [opened,setOpened] = useState('');
  const previousBrowse = useRef<{criteria: BrowseCriteria; range:{first:number;last:number}; scroll:number; opened:string; showHidden:boolean} | null>(null);
  const [newest, setNewest] = useState(initial.newest);
  const [explicitSort, setExplicitSort] = useState(initial.explicitSort);
  const { entries, toggle, markApplied } = useShortlist(jobs);
  const previousVisit = usePreviousVisit(fetchedAt);
  const liveIds = useMemo(() => new Set(jobs.map(job => job.id)), [jobs]);
  const saved = useMemo(() => new Set(Object.keys(entries)), [entries]);
  const expired = useMemo(() => new Set(expiredIds), [expiredIds]);
  const archived = useMemo(() => Object.values(entries).flatMap(({ job }) => job && !liveIds.has(job.id) && !expired.has(job.id) && listingKnownSince(job, fetchedAt) >= cutoff ? [job] : []), [entries, liveIds, expired, cutoff, fetchedAt]);
  const [detail, setDetail] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [range, setRange] = useState({ first: 0, last: 0 });
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
  const indexed = useMemo(() => [...jobs, ...archived].map(job => ({ job, index: indexJob(job), fields: jobFields(job.title, job.department), level:experienceLevel(job.title), region:job.isRemote?remoteEligibility(job.location):null })), [jobs, archived]);

  const applyCriteria = useCallback((state: BrowseCriteria) => {
    setSearch(state.search); setScope(state.scope); setRemote(state.remote); setWeek(state.week);
    setCompany(state.company);setLevel(state.level);setSalary(state.salary);setCountry(state.country);setUnspecified(state.unspecified);
    setOpened('');setShowHidden(false);setField(state.field); setNewest(state.newest); setExplicitSort(state.explicitSort);
    setSource(state.source); setSortKey(state.sortKey); setAscending(state.ascending); setRange({ first: 0, last: 0 });
  }, []);

  useEffect(() => {
    function restore() {
      const state = readBrowseParams(new URL(window.location.href).searchParams);
      applyCriteria(state);
      const prior = previousBrowse.current;
      if (prior && !state.company) {
        previousBrowse.current = null;
        setRange(prior.range);
        setOpened(prior.opened);
        setShowHidden(prior.showHidden);
        requestAnimationFrame(() => {
          document.getElementById('details-trigger-' + prior.opened)?.focus({ preventScroll: true });
          window.scrollTo(0, prior.scroll);
        });
      }
    }
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [applyCriteria]);

  useEffect(() => {
    let retry: number | undefined;
    function persist() {
      const url = new URL(window.location.href);
      writeBrowseParams(url.searchParams, { search, scope, remote, week, source, sortKey, ascending, field, newest, company, level, salary, country, unspecified, explicitSort });
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
  }, [search, scope, remote, week, source, sortKey, ascending, field, newest, company, level, salary, country, unspecified, explicitSort]);

  useEffect(() => {
    function sync() {
      try {
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
    const { adding, persisted } = toggle(job);
    if (!adding && scope === 'Saved') {
      const row = trigger.closest('.listing-row');
      const adjacent = row?.nextElementSibling ?? row?.previousElementSibling;
      const nextButton = adjacent?.querySelector<HTMLButtonElement>('.save-job');
      if (nextButton) nextButton.focus();
      else requestAnimationFrame(() => (emptyAction.current ?? results.current)?.focus());
    }
    if (persisted) setMessage((adding ? 'Saved ' : 'Removed ') + job.title);
    else {
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
    setShowHidden(false); setOpened(''); setSearch(''); setRemote(false); setWeek(false); setSource('all'); setField('all'); setCompany('');setLevel('all');setSalary(false);setCountry('');setUnspecified(false);setNewest(false); setPage(0);
    input.current?.focus();
  }

  function sortBy(key: SortKey, asc = sortKey === key && !(terms.length && !explicitSort) ? !ascending : key !== 'postedAt') {
    setExplicitSort(true); setSortKey(key); setAscending(asc); setPage(0);
  }

  const savedCount = indexed.filter(({ job }) => saved.has(job.id)).length;
  const selectedFields = useMemo(()=>field==='all'?[]:field.split(',') as DesignField[],[field]);
  const companyCounts = useMemo(()=>{
    const counts=new Map<string,number>();
    for (const job of jobs) {
      if (!hiddenIds.has(job.id)) counts.set(job.company, (counts.get(job.company) || 0) + 1);
    }
    return counts;
  },[jobs, hiddenIds]);
  const { matches, closeTitles, newCount, fieldCounts, olderCount } = useMemo(() => {
    const candidates = indexed.filter(({ job, region, level: jobLevel }) => {
      if (scope !== 'Saved' && !liveIds.has(job.id)) return false;
      if (showHidden ? !hiddenIds.has(job.id) : hiddenIds.has(job.id) && scope !== 'Saved') return false;
      if (scope === 'Saved' && !saved.has(job.id)) return false;
      if (scope === 'AI companies' && !job.isAI) return false;
      if ((remote || country) && !job.isRemote) return false;
      if (company && job.company !== company) return false;
      if (salary && !job.salary) return false;
      if (level !== 'all' && jobLevel !== level) return false;
      if (country && !(region?.worldwide || region?.countries.has(country) || (unspecified && region?.unspecified))) return false;
      return source === 'all' || listingSources(job).some(v=>v===source);
    });
    function searchPool(pool: typeof candidates) {
      if (search.trim() && !terms.length) return {hits:[],close:false};
      const exact = pool.filter(({index})=>jobMatches(index,terms));
      if (exact.length || !terms.some(term=>term.length>=5)) return {hits:exact,close:false};
      return {hits:pool.filter(({index})=>jobMatches(index,terms,true)),close:true};
    }
    const isNew = (job: Job) => previousVisit !== null && (job.firstSeenAt ?? 0) > previousVisit && liveIds.has(job.id);
    function count(pool:typeof candidates) {return searchPool(pool).hits.filter(({job})=>!newest || isNew(job)).length;}
    const recent = week ? candidates.filter(({job})=>{
      const age=fetchedAt-Date.parse(job.postedAt);
      return job.dateKind==='posted' && age>=0 && age<=7*86400000;
    }) : candidates;
    const inField = (item:typeof candidates[number])=>!selectedFields.length || selectedFields.some(f=>item.fields.includes(f));
    const {hits:allHits,close} = searchPool(recent.filter(inField));
    const newCount = allHits.filter(({job})=>isNew(job)).length;
    const hits = newest ? allHits.filter(({job})=>isNew(job)) : allHits;
    const fieldCounts:Record<string,number>={all:count(recent)};
    for (const f of Object.keys(fields) as DesignField[]) fieldCounts[f]=count(recent.filter(item=>item.fields.includes(f)));
    const olderCount = week && !hits.length ? count(candidates.filter(inField)) : 0;
    const ranked = hits.map(({ job, index }) => ({ job, score: terms.length && !explicitSort ? titleRelevance(index, terms, close) : 0 }));
    ranked.sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      const a = left.job, b = right.job;
      if (sortKey === 'postedAt' && Boolean(a.postedAt) !== Boolean(b.postedAt)) return a.postedAt ? -1 : 1;
      const order = a[sortKey].toLowerCase().localeCompare(b[sortKey].toLowerCase(), 'en');
      return ascending ? order : -order;
    });
    return { matches: ranked.map(hit => hit.job), closeTitles: close && hits.length > 0, newCount, fieldCounts, olderCount };
  }, [indexed, scope, saved, remote, source, week, fetchedAt, search, terms, sortKey, ascending, newest, previousVisit, liveIds, explicitSort, selectedFields, hiddenIds, showHidden, salary, level, country, unspecified, company]);
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
  const criteria = { search, scope, remote, week, source, sortKey, ascending, field, newest, company, level, salary, country, unspecified, explicitSort };
  const hasFilters = Boolean(company || salary || level!=='all' || country || search || remote || week || source !== 'all' || field !== 'all' || newest);
  const snapshotYear = new Date(fetchedAt).getUTCFullYear();
  const emptySaved = scope === 'Saved' && savedCount === 0;

  function browseCompany(name:string) {
    previousBrowse.current={criteria,range,scroll:window.scrollY,opened,showHidden};
    const next={...readBrowseParams(new URLSearchParams()),company:name};
    const url=new URL(window.location.href); writeBrowseParams(url.searchParams,next);
    window.history.pushState(null,'',url);applyCriteria(next);
    results.current?.focus();results.current?.scrollIntoView({block:'start'});
  }
  function leaveCompany() {
    if (previousBrowse.current) window.history.back();
    else { setCompany(''); setPage(0); results.current?.focus(); }
  }
  function changeHidden(job: Job) {
    const hide = !hiddenIds.has(job.id);
    setRoleHidden(job.id, hide);
    setUndoId(hide ? job.id : '');
    setOpened('');
    setMessage(hide ? 'Role hidden' : 'Role restored');
    if (!hide && hidden.length === 1) setShowHidden(false);
    results.current?.focus({ preventScroll: true });
  }

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
  const bestMatch = Boolean(terms.length && !explicitSort);
  const customSort = explicitSort && (terms.length > 0 || sortKey !== 'postedAt' || ascending);
  const filterCount = Number(week) + Number(source !== 'all') + selectedFields.length + Number(newest) + Number(salary) + Number(level!=='all') + Number(Boolean(country)) + Number(showHidden);
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
            <button type="button" className="board-control" ref={filterTrigger} aria-label={filterCount ? `Filters, ${filterCount} active` : 'Filters'} aria-expanded={filtersOpen} title="Filters" aria-controls="board-filters" onKeyDown={event => {
              if (filtersOpen && event.key === 'Tab' && !event.shiftKey) {
                event.preventDefault(); document.getElementById('field-filter')?.focus();
              }
            }} onClick={() => setFiltersOpen(!filtersOpen)}>
              <SlidersHorizontal size={16} aria-hidden="true" /><span className="filter-label">Filters</span>{filterCount > 0 && <span className="filter-count" aria-hidden="true">{filterCount}</span>}
            </button>
          </div>
        </div>
        <div id="board-filters" className="board-filters" hidden={!filtersOpen} onKeyDown={event => {
          if (event.key === 'Tab' && event.shiftKey && event.target instanceof HTMLElement && event.target.id === 'field-filter') {
            event.preventDefault(); filterTrigger.current?.focus();
          }
          if (event.key === 'Escape' && !(event.target instanceof HTMLElement && event.target.closest('[role=listbox]'))) {
            setFiltersOpen(false);
            filterTrigger.current?.focus();
          }
        }}>
          <FieldPicker value={field} counts={fieldCounts} onChange={value=>{setField(value);setPage(0);}}/>
          <BoardSelect id="level-filter" label="Experience level" value={level}
            options={[{value:'all',label:'All levels'},...Object.entries(levels).map(([value,label])=>({value,label}))]}
            onChange={value=>{setLevel(value as BrowseCriteria['level']);setPage(0);}}/>
          <BoardSelect id="portal-filter" label="Job portal" value={source}
            options={[{ value: 'all', label: 'All portals' }, ...Object.entries(sources).map(([value, label]) => ({ value, label }))]}
            onChange={value => { setSource(value); setPage(0); }} />
          <BoardSelect id="sort-order" label="Sort by" value={bestMatch ? 'best' : sortKey + (ascending ? '+' : '-')}
            options={[...(terms.length ? [{ value: 'best', label: 'Best match' }] : []),
              ...(Object.keys(columns) as SortKey[]).flatMap(key => (key === 'postedAt' ? ['-', '+'] : ['+', '-']).map(dir =>
                ({ value: key + dir, label: sortLabel(key, dir === '+') })))]}
            onChange={value => {
              if (value === 'best') { setExplicitSort(false); setSortKey('postedAt'); setAscending(false); setPage(0); }
              else sortBy(value.slice(0, -1) as SortKey, value.endsWith('+'));
            }} />
          {(remote || country) && <BoardSelect id="country-filter" label="Remote from" value={country || 'all'} options={[{value:'all',label:'Any country'},...countries]}
            onChange={value=>{setCountry(value==='all'?'':value);setUnspecified(false);setPage(0);}}/>}
          <div className="filter-toggles">
          <label className="board-control"><input type="checkbox" checked={salary} onChange={e=>{setSalary(e.target.checked);setPage(0);}}/>Salary listed</label>
          {country && <label className="board-control"><input type="checkbox" checked={unspecified} onChange={e=>{setUnspecified(e.target.checked);setPage(0);}}/>Include unspecified countries</label>}
          {hidden.length>0 && <label className="board-control"><input type="checkbox" checked={showHidden} onChange={e=>{setShowHidden(e.target.checked);setScope('All roles');setPage(0);}}/>View hidden roles ({hidden.length})</label>}
          <label className="board-control"><input type="checkbox" checked={week} onChange={e => { setWeek(e.target.checked); setPage(0); }} />Posted in the last 7 days</label>
          <label className="board-control"><input type="checkbox" checked={detail} onChange={toggleDetail} />Show job details</label>
          </div>
          <SavedSearches criteria={criteria} apply={applyCriteria} />
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
                <label className="board-control remote-control"><input type="checkbox" checked={remote} onChange={e => { setRemote(e.target.checked); if (!e.target.checked) {setCountry('');setUnspecified(false);} setPage(0); }} aria-label="Remote only" />Remote</label>
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
                {(newCount > 0 || newest) && <button type="button" className="filter-chip" aria-pressed={newest} onClick={() => { setNewest(!newest); setPage(0); }}>
                  {newCount} new since last visit {newest && <X size={12} />}</button>}
                {selectedFields.map(f=><button type="button" key={f} className="filter-chip" aria-label={'Remove '+fields[f]+' filter'} onClick={()=>{setField(selectedFields.filter(v=>v!==f).join(',')||'all');setPage(0);}}>{fields[f]} <X size={12}/></button>)}
                {company && <button className="filter-chip" onClick={leaveCompany}>{company} · Back to results <X size={12}/></button>}
                {level!=='all' && <button className="filter-chip" onClick={()=>{setLevel('all');setPage(0);}}>{levels[level]} <X size={12}/></button>}
                {salary && <button className="filter-chip" onClick={()=>{setSalary(false);setPage(0);}}>Salary listed <X size={12}/></button>}
                {country && <button className="filter-chip" onClick={()=>{setCountry('');setUnspecified(false);setPage(0);}}>{countries.find(c=>c.value===country)?.label} <X size={12}/></button>}
                {showHidden && <button className="filter-chip" onClick={()=>{setShowHidden(false);setPage(0);}}>Hidden roles <X size={12}/></button>}
                {customSort && <span className="sort-summary">{sortLabel(sortKey, ascending)}</span>}
                {source !== 'all' && <button type="button" className="filter-chip" aria-label={'Remove ' + sources[source as AtsSource] + ' filter'}
                  onClick={() => { setSource('all'); setPage(0); filterTrigger.current?.focus(); }}>{sources[source as AtsSource]} <X size={12} /></button>}
                {week && <button type="button" className="filter-chip" aria-label="Remove last 7 days filter"
                  onClick={() => { setWeek(false); setPage(0); filterTrigger.current?.focus(); }}>Last 7 days <X size={12} /></button>}
              </div>
            </div>
            {visible.length ? <div className="listings-table" data-details={detail} role="table" aria-label="Design job listings">
              <div className="listing-head" role="row">
                {(Object.keys(columns) as SortKey[]).map(key => <div key={key} role="columnheader" aria-sort={!bestMatch && key === sortKey ? (ascending ? 'ascending' : 'descending') : undefined}>
                  <button type="button" onClick={() => sortBy(key)}>{columns[key]}{!bestMatch && key === sortKey && (ascending ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />)}</button>
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
                  <a id={'listing-' + job.id} href={job.url} target="_blank" rel="noopener noreferrer" className="role-title" data-full-text={job.title}><span data-clip=""><HighlightText text={job.title} terms={terms} /><span className="title-arrow" aria-hidden="true">{'\u2060'}<ArrowUpRight size={13} /></span></span></a>
                  {detail && job.department && <div className="role-detail">{job.department}</div>}
                  {detail && job.salary && <div className="salary-detail">Salary · {job.salary}</div>}
                  {scope === 'Saved' && <div className="saved-role-state">
                    {!liveIds.has(job.id) && <span>No longer listed</span>}
                    <button type="button" aria-pressed={Boolean(entries[job.id]?.applied)} aria-label={'Mark as applied: ' + job.title} onClick={() => {
                      if (!markApplied(job)) { setNotice('Application status will last for this visit.'); }
                    }}>{entries[job.id]?.applied ? <><Check size={13} />Applied</> : 'Mark as applied'}</button>
                  </div>}
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
                  <button type="button" className="row-disclosure" id={'details-trigger-' + job.id} aria-label={(opened === job.id ? 'Close details for ' : 'Show details for ') + job.title}
                    aria-expanded={opened === job.id} aria-controls={opened === job.id ? 'detail-' + job.id : undefined}
                    title="Job details" onClick={() => setOpened(opened === job.id ? '' : job.id)}><ChevronDown size={16} aria-hidden="true" /></button>
                  {detail && <button type="button" className="copy-job" title={copiedId === job.id ? 'Link copied' : 'Copy job link'} aria-label={'Copy link to ' + job.title} onClick={event => copy(job, event.currentTarget)}>{copiedId === job.id ? <Check size={15} /> : <Copy size={15} />}</button>}
                  <button type="button" className="save-job" title={saved.has(job.id) ? 'Remove from saved roles' : 'Save role'} aria-label={'Save ' + job.title + ' at ' + job.company} aria-pressed={saved.has(job.id)} onClick={event => toggleSaved(job, event.currentTarget)}>
                    {saved.has(job.id) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                  </button>
                  <a style={liveIds.has(job.id) ? undefined : { visibility: 'hidden' }} href={job.url} target="_blank" rel="noopener noreferrer" aria-label={'Apply for ' + job.title + ' at ' + job.company}><span className="apply-label">Apply <ArrowUpRight size={14} aria-hidden="true" /></span></a>
                </div></div>
                {opened === job.id && <div role="cell" id={'detail-' + job.id} className="job-detail-panel">
                  <h3>{job.title}</h3>
                  <p>{job.location || 'Location unavailable'}</p>
                  {(job.department || job.salary) && <p>{[job.department, job.salary].filter(Boolean).join(' · ')}</p>}
                  <p><ListingDate job={job} currentYear={snapshotYear} /> · {listingSources(job).map(id => sources[id]).join(', ')}</p>
                  {job.lastVerifiedAt && <p>Last verified {new Date(job.lastVerifiedAt).toISOString().slice(0, 10)}</p>}
                  <div className="detail-actions">
                    {liveIds.has(job.id) && <a href={job.url} target="_blank" rel="noopener noreferrer">Apply <ArrowUpRight size={14} /></a>}
                    <button onClick={event => copy(job, event.currentTarget)}>{copiedId === job.id ? 'Link copied' : 'Copy link'}</button>
                    {company !== job.company && (companyCounts.get(job.company) ?? 0) > 1 &&
                      <button onClick={() => browseCompany(job.company)}>See all {companyCounts.get(job.company)} roles at {job.company}</button>}
                    <button onClick={() => changeHidden(job)}>{hiddenIds.has(job.id) ? 'Restore role' : 'Hide this role'}</button>
                  </div>
                </div>}
              </div>)}</div>
            </div> : <div className="board-empty">
              <span className="empty-icon" aria-hidden="true">{emptySaved ? <Bookmark size={22} /> : <Search size={22} />}</span>
              <h3>{emptySaved ? 'No saved roles yet' : scope === 'Saved' ? 'No saved roles match your filters' : 'No matching roles'}</h3>
              {olderCount>0 && <button className="board-control" onClick={()=>{setWeek(false);setPage(0);results.current?.focus();}}>Show older matches ({olderCount})</button>}
              <p>{emptySaved ? 'Use the bookmark beside a role to keep it here.' : 'Try another search or clear your filters.'}</p>
              <button ref={emptyAction} className="board-control" onClick={() => { resetFilters(); if (emptySaved || !hasFilters) setScope('All roles'); }}>{emptySaved || !hasFilters ? 'Browse all roles' : 'Clear filters'}</button>
            </div>}
            {pages > 1 && <nav className="board-pages" aria-label="Results pages">
              <div className="pages-mobile" ref={mobilePager}><span className="page-progress">{end-start} of {matches.length} shown</span>
                {firstPage > 0 && <button onClick={() => goToPage(firstPage - 1)}>Previous</button>}
                {current < pages - 1 && <button onClick={() => {
                  firstNewRow.current = 'listing-' + matches[end].id;
                  setRange({ first: firstPage, last: current + 1 });
                }}>Load {Math.min(PAGE_SIZE,matches.length-end)} more {matches.length-end===1?'role':'roles'}</button>}
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
      <ListingHint board={rowGroup} />
      {undoId && !notice && <div className="board-notice"><span role="status">Role hidden</span>
        <button onClick={() => { setRoleHidden(undoId, false); setUndoId(''); setMessage('Role restored'); results.current?.focus(); }}>Undo</button>
        <button aria-label="Dismiss notice" onClick={() => { setUndoId(''); results.current?.focus(); }}><X size={16} /></button>
      </div>}
      <p className="sr-only" role="status">{message}</p>
      {notice && <div className="board-notice"><span role="status">{notice}</span><button type="button" aria-label="Dismiss notice" onClick={() => {
        setNotice('');
        (noticeTrigger.current?.isConnected ? noticeTrigger.current : input.current)?.focus();
      }}><X size={16} /></button></div>}
    </div>
  );
}
