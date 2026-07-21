'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Filter,
  List,
  MapPin,
  Rows3,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { AtsSource, Job } from '@/types/job';
import { formatRelativeDate } from '@/lib/formatDate';

const PAGE_SIZE = 50;
const SAVED_JOBS_KEY = 'design-jobs:saved';
const VIEW_MODE_KEY = 'design-jobs:view-mode';

interface Props {
  jobs: Job[];
}

type SortKey = 'company' | 'title' | 'location' | 'postedAt';
type SortDir = 'asc' | 'desc';
type ViewMode = 'compact' | 'detail';

const ATS_LABELS: Record<AtsSource, string> = {
  yc: 'YC',
  ashby: 'ASHBY',
  greenhouse: 'GH',
  lever: 'LEVER',
  remotive: 'REMOTIVE',
  workday: 'WORKDAY',
};

const ATS_COLORS: Record<AtsSource, string> = {
  yc: 'bg-orange-100 text-orange-800 dark:bg-orange-400/15 dark:text-orange-200',
  ashby: 'bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200',
  greenhouse: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200',
  lever: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200',
  remotive: 'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200',
  workday: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200',
};

function isKnownRecentDate(dateStr: string, days: number) {
  const time = new Date(dateStr).getTime();
  return time > new Date('2000-01-01').getTime() && Date.now() - time <= days * 24 * 60 * 60 * 1000;
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

function CompanyCell({ job, query }: { job: Job; query: string }) {
  return (
    <button
      type="button"
      className="focus-ring radius-control lift-hover flex min-w-0 items-center gap-2.5 text-left"
      title={job.company}
      onClick={() => {
        const url = job.companyDomain ? `https://${job.companyDomain}` : job.url;
        window.open(url, '_blank', 'noopener,noreferrer');
      }}
    >
      <CompanyAvatar job={job} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">
          <HighlightText text={job.company} query={query} />
        </span>
        {job.batch && (
          <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground/90">{job.batch}</span>
        )}
      </span>
    </button>
  );
}

function SourceBadges({ sources }: { sources: AtsSource[] }) {
  const sorted = [...sources].sort((a, b) => {
    const order: AtsSource[] = ['yc', 'ashby', 'greenhouse', 'lever', 'remotive', 'workday'];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <span className="flex flex-wrap gap-1">
      {sorted.map(source => (
        <span
          key={source}
          className={`radius-chip inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.04em] ${ATS_COLORS[source]}`}
        >
          {ATS_LABELS[source]}
        </span>
      ))}
    </span>
  );
}

function RemoteBadge() {
  return (
    <span className="radius-chip inline-flex shrink-0 items-center bg-[hsl(var(--accent-lime)/0.18)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.04em] text-[hsl(var(--accent-teal))] dark:bg-[hsl(84_76%_43%/0.18)] dark:text-[hsl(84_72%_68%)]">
      REMOTE
    </span>
  );
}

function IconButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`focus-ring radius-control inline-flex h-8 w-8 items-center justify-center border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
        active ? 'border-[hsl(var(--accent-teal)/0.5)] bg-[hsl(var(--accent-teal)/0.08)] text-[hsl(var(--accent-teal))]' : 'border-border'
      }`}
    >
      {children}
    </button>
  );
}

function InlineSaveAction({
  saved,
  onToggleSaved,
}: {
  saved: boolean;
  onToggleSaved: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={saved ? 'Unsave job' : 'Save job'}
      title={saved ? 'Unsave job' : 'Save job'}
      onClick={onToggleSaved}
      className={`focus-ring radius-control inline-flex h-8 w-8 items-center justify-center border bg-card text-muted-foreground transition-[opacity,background-color,border-color,color] hover:bg-muted hover:text-foreground ${
        saved ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
      } ${saved ? 'border-[hsl(var(--accent-teal)/0.45)] text-[hsl(var(--accent-teal))]' : 'border-border'}`}
    >
      {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
    </button>
  );
}

function SortIndicator({ active }: { active: boolean }) {
  return (
    <ArrowUpDown
      size={13}
      className={active ? 'text-[hsl(var(--accent-teal))]' : 'opacity-30'}
    />
  );
}

function JobCard({
  job,
  index,
  query,
  saved,
  viewMode,
  copied,
  onCopy,
  onToggleSaved,
}: {
  job: Job;
  index: number;
  query: string;
  saved: boolean;
  viewMode: ViewMode;
  copied: boolean;
  onCopy: () => void;
  onToggleSaved: () => void;
}) {
  return (
    <article
      className="row-enter radius-surface lift-hover border border-border bg-card shadow-soft"
      style={{ animationDelay: `${Math.min(index, 8) * 18}ms` }}
    >
      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-3"
      >
        <div className="flex items-start gap-3">
          <CompanyAvatar job={job} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-sm font-medium leading-5 text-foreground">
                  <HighlightText text={job.title} query={query} />
                </h3>
                <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                  <HighlightText text={job.company} query={query} />
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 pl-1">
                <button
                  type="button"
                  aria-label={saved ? 'Unsave role' : 'Save role'}
                  title={saved ? 'Unsave role' : 'Save role'}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleSaved(); }}
                  className={`focus-ring radius-control inline-flex h-8 w-8 items-center justify-center border transition-colors ${
                    saved
                      ? 'border-[hsl(var(--accent-teal)/0.45)] bg-[hsl(var(--accent-teal)/0.08)] text-[hsl(var(--accent-teal))]'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                </button>
                <span className="btn-classic-primary inline-flex h-8 w-8 items-center justify-center sm:w-auto sm:px-3">
                  <ArrowUpRight size={14} className="sm:hidden" />
                  <span className="hidden text-xs font-medium sm:inline">Apply</span>
                </span>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin size={12} className="shrink-0" />
                <span className="truncate"><HighlightText text={job.location || 'Location not listed'} query={query} /></span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={12} />
                {formatRelativeDate(job.postedAt)}
              </span>
              {job.isRemote && <RemoteBadge />}
            </div>

            {viewMode === 'detail' && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <SourceBadges sources={job.sources} />
                {job.department && <span className="radius-chip bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{job.department}</span>}
                <button
                  type="button"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); onCopy(); }}
                  className="focus-ring radius-chip inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        </div>
      </a>
    </article>
  );
}

export default function JobTable({ jobs }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [aiOnly, setAiOnly] = useState(false);
  const [postedThisWeek, setPostedThisWeek] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [atsFilter, setAtsFilter] = useState<AtsSource | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('postedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 140);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SAVED_JOBS_KEY);
    if (stored) setSavedIds(new Set(JSON.parse(stored) as string[]));
    const storedView = window.localStorage.getItem(VIEW_MODE_KEY);
    if (storedView === 'compact' || storedView === 'detail') setViewMode(storedView);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable;
      if (event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const persistSaved = (next: Set<string>) => {
    setSavedIds(next);
    window.localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify(Array.from(next)));
  };

  const toggleSaved = (id: string) => {
    const next = new Set(savedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persistSaved(next);
  };

  const setAndStoreViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const copyJob = async (job: Job) => {
    await navigator.clipboard.writeText(`${job.title} at ${job.company}: ${job.url}`);
    setCopiedId(job.id);
    window.setTimeout(() => setCopiedId(current => (current === job.id ? null : current)), 1400);
  };

  const resetFilters = () => {
    setSearch('');
    setRemoteOnly(false);
    setAiOnly(false);
    setPostedThisWeek(false);
    setSavedOnly(false);
    setAtsFilter('all');
    setPage(0);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'postedAt' ? 'desc' : 'asc');
    }
    setPage(0);
  };

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, remoteOnly, aiOnly, postedThisWeek, savedOnly, atsFilter]);

  const filtered = useMemo(() => {
    let list = jobs;

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      list = list.filter(job =>
        job.title.toLowerCase().includes(query) ||
        job.company.toLowerCase().includes(query) ||
        job.location.toLowerCase().includes(query)
      );
    }

    if (remoteOnly) list = list.filter(job => job.isRemote);
    if (aiOnly) list = list.filter(job => job.isAI);
    if (postedThisWeek) list = list.filter(job => isKnownRecentDate(job.postedAt, 7));
    if (savedOnly) list = list.filter(job => savedIds.has(job.id));
    if (atsFilter !== 'all') list = list.filter(job => job.sources.includes(atsFilter));

    const unknownThreshold = new Date('2000-01-01').getTime();

    return [...list].sort((a, b) => {
      if (sortKey === 'postedAt') {
        const aTime = new Date(a.postedAt).getTime();
        const bTime = new Date(b.postedAt).getTime();
        const aUnknown = aTime < unknownThreshold;
        const bUnknown = bTime < unknownThreshold;
        if (aUnknown && !bUnknown) return 1;
        if (!aUnknown && bUnknown) return -1;
        if (aUnknown && bUnknown) return 0;
        const cmp = aTime - bTime;
        return sortDir === 'asc' ? cmp : -cmp;
      }

      const cmp = (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [jobs, debouncedSearch, remoteOnly, aiOnly, postedThisWeek, savedOnly, savedIds, atsFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const mobileVisible = filtered.slice(0, (page + 1) * PAGE_SIZE);
  const uniqueCompanies = useMemo(() => new Set(filtered.map(job => job.company)).size, [filtered]);
  const firstResult = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastResult = Math.min((page + 1) * PAGE_SIZE, filtered.length);
  const hasFilters = Boolean(debouncedSearch.trim() || remoteOnly || aiOnly || postedThisWeek || savedOnly || atsFilter !== 'all');

  const chipClass = (active: boolean) =>
    `focus-ring radius-control inline-flex h-9 items-center gap-1.5 border px-2.5 text-[13px] font-medium transition-colors lg:h-8 lg:text-xs ${
      active
        ? 'border-[hsl(var(--accent-teal)/0.45)] bg-[hsl(var(--accent-teal)/0.08)] text-[hsl(var(--accent-teal))]'
        : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
    }`;

  const sourceOptions = (
    <>
      <option value="all">All sources</option>
      <option value="yc">YC</option>
      <option value="ashby">Ashby</option>
      <option value="greenhouse">Greenhouse</option>
      <option value="lever">Lever</option>
      <option value="remotive">Remotive</option>
      <option value="workday">Workday</option>
    </>
  );

  const FilterControls = ({
    includeRemote = true,
    compactSource = false,
  }: {
    includeRemote?: boolean;
    compactSource?: boolean;
  }) => (
    <>
      {includeRemote && (
        <label className="radius-control focus-within:ring-ring/20 flex h-10 items-center gap-2 border border-input bg-background px-3 text-[14px] font-medium text-muted-foreground sm:h-10 lg:h-9 lg:w-[136px] lg:text-sm">
          <input
            type="checkbox"
            checked={remoteOnly}
            onChange={event => setRemoteOnly(event.target.checked)}
          />
          Remote only
        </label>
      )}

      {compactSource ? (
        <label
          className={`focus-ring radius-control relative inline-flex h-9 w-9 items-center justify-center border bg-background text-muted-foreground hover:bg-muted hover:text-foreground ${
            atsFilter === 'all' ? 'border-input' : 'border-[hsl(var(--accent-teal)/0.45)] text-[hsl(var(--accent-teal))]'
          }`}
          title="Filter by source"
        >
          <Filter size={15} aria-hidden="true" />
          <select
            value={atsFilter}
            onChange={event => setAtsFilter(event.target.value as AtsSource | 'all')}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Filter by source"
          >
            {sourceOptions}
          </select>
        </label>
      ) : (
        <label className="relative">
          <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <select
            value={atsFilter}
            onChange={event => setAtsFilter(event.target.value as AtsSource | 'all')}
            className="focus-ring radius-control h-10 w-full appearance-none border border-input bg-background pl-9 pr-8 text-[14px] font-medium text-muted-foreground sm:h-10 lg:h-9 lg:w-[136px] lg:text-sm"
            aria-label="Filter by source"
          >
            {sourceOptions}
          </select>
        </label>
      )}

      <select
        value={`${sortKey}:${sortDir}`}
        onChange={event => {
          const [key, dir] = event.target.value.split(':') as [SortKey, SortDir];
          setSortKey(key);
          setSortDir(dir);
          setPage(0);
        }}
        className="focus-ring radius-control h-10 border border-input bg-background px-3 text-[14px] font-medium text-muted-foreground sm:h-10 lg:hidden"
        aria-label="Sort jobs"
      >
        <option value="postedAt:desc">Newest first</option>
        <option value="postedAt:asc">Oldest first</option>
        <option value="company:asc">Company A-Z</option>
        <option value="title:asc">Role A-Z</option>
        <option value="location:asc">Location A-Z</option>
      </select>
    </>
  );

  return (
    <div className="space-y-3">
      <div className="radius-surface z-20 border-0 bg-transparent p-0 shadow-none backdrop-blur-none lg:sticky lg:top-2 lg:border lg:border-border lg:bg-card/95 lg:p-3 lg:shadow-soft lg:backdrop-blur">
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 gap-2 lg:min-w-0">
            <div className="relative min-w-0 flex-1">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground lg:left-3 lg:size-4" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search roles, companies, locations..."
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="focus-ring radius-surface h-11 w-full border border-input bg-card px-10 text-[15px] text-foreground shadow-soft placeholder:text-muted-foreground lg:radius-control lg:h-9 lg:bg-background lg:px-9 lg:text-sm lg:shadow-none xl:h-10 xl:px-10"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="focus-ring radius-control absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                  type="button"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowMobileFilters(open => !open)}
              className="focus-ring radius-surface inline-flex h-11 w-11 shrink-0 items-center justify-center border border-input bg-card text-muted-foreground shadow-soft hover:bg-muted hover:text-foreground lg:hidden"
              aria-label="Filters"
            >
              <SlidersHorizontal size={17} />
            </button>
          </div>

          <div className="hidden justify-end gap-2 lg:grid lg:grid-cols-[auto_auto]">
            <FilterControls compactSource />
          </div>
        </div>

        <div className="mt-3 flex h-6 items-center justify-between gap-3 text-[14px] leading-none text-muted-foreground lg:hidden">
          <label className="focus-ring radius-control inline-flex min-w-0 items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={event => setRemoteOnly(event.target.checked)}
            />
            <span className="whitespace-nowrap">Remote Only</span>
          </label>
          <span className="truncate text-right text-[14px]">
            <span className="text-foreground">{filtered.length.toLocaleString()}</span> positions at <span className="text-foreground">{uniqueCompanies.toLocaleString()}</span> companies
          </span>
        </div>

        {showMobileFilters && (
          <div className="mt-3 grid grid-cols-1 gap-2 lg:hidden">
            <FilterControls includeRemote={false} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={chipClass(aiOnly)} onClick={() => setAiOnly(value => !value)}>AI</button>
              <button type="button" className={chipClass(atsFilter === 'yc')} onClick={() => setAtsFilter(value => (value === 'yc' ? 'all' : 'yc'))}>YC</button>
              <button type="button" className={chipClass(postedThisWeek)} onClick={() => setPostedThisWeek(value => !value)}>This week</button>
              <button type="button" className={chipClass(savedOnly)} onClick={() => setSavedOnly(value => !value)}>
                <Bookmark size={13} />
                Saved
              </button>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="focus-ring radius-control inline-flex h-8 items-center border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-2 hidden flex-wrap items-center gap-2 lg:flex">
          <button type="button" className={chipClass(aiOnly)} onClick={() => setAiOnly(value => !value)}>AI</button>
          <button type="button" className={chipClass(atsFilter === 'yc')} onClick={() => setAtsFilter(value => (value === 'yc' ? 'all' : 'yc'))}>YC</button>
          <button type="button" className={chipClass(postedThisWeek)} onClick={() => setPostedThisWeek(value => !value)}>This week</button>
          <button type="button" className={chipClass(savedOnly)} onClick={() => setSavedOnly(value => !value)}>
            <Bookmark size={13} />
            Saved
          </button>

          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Compact view" onClick={() => setAndStoreViewMode('compact')} active={viewMode === 'compact'}>
              <Rows3 size={14} />
            </IconButton>
            <IconButton label="Detailed view" onClick={() => setAndStoreViewMode('detail')} active={viewMode === 'detail'}>
              <List size={14} />
            </IconButton>
          </div>
        </div>

        {hasFilters && (
          <div className="mt-2 hidden flex-wrap items-center gap-2 text-xs text-muted-foreground lg:flex">
            <span className="radius-chip bg-muted px-2 py-1">
              {filtered.length.toLocaleString()} matching roles
            </span>
            <span className="radius-chip bg-muted px-2 py-1">
              {uniqueCompanies.toLocaleString()} companies
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="focus-ring radius-chip bg-muted px-2 py-1 font-medium text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-2.5 lg:hidden">
        {mobileVisible.length === 0 ? (
          <div className="radius-surface border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground shadow-soft">
            <p>No roles match your filters.</p>
            {hasFilters && (
              <button type="button" onClick={resetFilters} className="btn-classic-primary mt-3 inline-flex h-8 items-center px-3 text-xs font-medium">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          mobileVisible.map((job, index) => (
            <JobCard
              key={job.id}
              job={job}
              index={index}
              query={debouncedSearch}
              saved={savedIds.has(job.id)}
              viewMode={viewMode}
              copied={copiedId === job.id}
              onCopy={() => copyJob(job)}
              onToggleSaved={() => toggleSaved(job.id)}
            />
          ))
        )}
      </div>

      {mobileVisible.length < filtered.length && (
        <button
          type="button"
          onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))}
          className="focus-ring radius-control mx-auto flex h-10 w-full items-center justify-center border border-border text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        >
          Load more
        </button>
      )}

      <div className="radius-surface hidden overflow-hidden border border-border bg-card shadow-soft lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] table-fixed">
            <thead>
              <tr className="table-head-surface border-b border-border">
                {[
                  ['company', 'Company', 'w-[210px]'],
                  ['title', 'Role', ''],
                  ['location', 'Location', 'w-[190px]'],
                  ['postedAt', 'Posted', 'w-[96px]'],
                ].map(([key, label, width]) => (
                  <th
                    key={key}
                    className={`px-3.5 py-2.5 text-left text-xs font-medium leading-none text-muted-foreground ${width}`}
                  >
                    <button
                      type="button"
                      className="focus-ring radius-chip inline-flex h-5 items-center gap-1.5 font-medium hover:text-foreground"
                      onClick={() => handleSort(key as SortKey)}
                    >
                      {label}
                      <SortIndicator active={sortKey === key} />
                    </button>
                  </th>
                ))}
                <th className="w-[92px] px-3.5 py-2.5 text-left text-xs font-medium leading-none text-muted-foreground">
                  <span className="inline-flex h-5 items-center font-medium">Source</span>
                </th>
                <th className="w-[112px] px-2.5 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-sm text-muted-foreground">
                    <p>No roles match your filters.</p>
                    {hasFilters && (
                      <button type="button" onClick={resetFilters} className="btn-classic-primary mt-3 inline-flex h-8 items-center px-3 text-xs font-medium">
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginated.map((job, index) => (
                  <tr
                    key={job.id}
                    className="row-enter group border-b border-border/50 last:border-0 hover:bg-muted/30"
                    style={{ animationDelay: `${Math.min(index, 10) * 12}ms` }}
                  >
                    <td className="px-3.5 py-2 align-middle">
                      <CompanyCell job={job} query={debouncedSearch} />
                    </td>
                    <td className="px-3.5 py-2 align-middle">
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          <HighlightText text={job.title} query={debouncedSearch} />
                        </span>
                        {viewMode === 'detail' && job.department && (
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {job.department}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3.5 py-2 align-middle text-sm text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-2">
                        <MapPin size={14} className="shrink-0" />
                        <span className="truncate"><HighlightText text={job.location || 'Not listed'} query={debouncedSearch} /></span>
                        {job.isRemote && <RemoteBadge />}
                      </span>
                    </td>
                    <td className="px-3.5 py-2 align-middle text-sm text-muted-foreground">
                      {formatRelativeDate(job.postedAt)}
                    </td>
                    <td className="px-3.5 py-2 align-middle">
                      <SourceBadges sources={job.sources} />
                    </td>
                    <td className="px-2.5 py-2 text-right align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <InlineSaveAction
                          saved={savedIds.has(job.id)}
                          onToggleSaved={() => toggleSaved(job.id)}
                        />
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-classic-primary inline-flex h-8 items-center justify-center px-3 text-xs font-medium"
                        >
                          Apply
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="radius-surface hidden gap-2.5 border border-border bg-card px-3 py-3 shadow-soft sm:items-center sm:justify-between lg:flex">
          <span className="text-xs text-muted-foreground">
            Showing {firstResult.toLocaleString()}-{lastResult.toLocaleString()} of {filtered.length.toLocaleString()}
          </span>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setPage(current => Math.max(0, current - 1))}
              disabled={page === 0}
              type="button"
              className="focus-ring radius-control inline-flex h-9 items-center justify-center gap-1.5 border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              Prev
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
              const pageNumber = totalPages <= 5
                ? index
                : page < 2
                  ? index
                  : page > totalPages - 3
                    ? totalPages - 5 + index
                    : page - 2 + index;

              return (
                <button
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                  type="button"
                  className={`focus-ring radius-control h-9 w-9 shrink-0 border text-xs font-medium ${
                    pageNumber === page
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {pageNumber + 1}
                </button>
              );
            })}

            <button
              onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))}
              disabled={page >= totalPages - 1}
              type="button"
              className="focus-ring radius-control inline-flex h-9 items-center justify-center gap-1.5 border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
