'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Layers3 } from 'lucide-react';
import type { Job } from '@/types/job';
import JobTable from './JobTable';

interface Props {
  title: string;
  subtitle?: string;
  jobs: Job[];
  defaultOpen?: boolean;
  badge?: string;
}

export default function Section({ title, subtitle, jobs, defaultOpen = true, badge }: Props) {
  const storageKey = useMemo(() => `design-jobs:section:${title}`, [title]);
  const [open, setOpen] = useState(defaultOpen);
  const companies = new Set(jobs.map(j => j.company)).size;

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'open') setOpen(true);
    if (stored === 'closed') setOpen(false);
  }, [storageKey]);

  const toggleOpen = () => {
    setOpen(current => {
      const next = !current;
      window.localStorage.setItem(storageKey, next ? 'open' : 'closed');
      return next;
    });
  };

  return (
    <section className="section-enter">
      <button
        type="button"
        onClick={toggleOpen}
        className="focus-ring radius-surface group mb-2.5 flex w-full items-center gap-2.5 border border-border bg-card px-3 py-2.5 text-left shadow-soft transition-colors hover:border-input sm:mb-3 sm:gap-3 sm:px-3.5 sm:py-2.5"
        aria-expanded={open}
      >
        <span className="radius-control flex h-8 w-8 shrink-0 items-center justify-center bg-[hsl(var(--accent-teal)/0.12)] text-[hsl(var(--accent-teal))] sm:h-9 sm:w-9">
          <Layers3 size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium leading-snug text-foreground sm:text-base">{title}</span>
            {badge && (
              <span className="radius-chip inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium uppercase text-[hsl(var(--accent-ink))] bg-[hsl(var(--accent-lime)/0.75)]">
                {badge}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground sm:text-xs">
            {jobs.length.toLocaleString()} roles across {companies.toLocaleString()} companies
            {subtitle ? ` · ${subtitle}` : ''}
          </span>
        </span>
        <ChevronDown
          size={17}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ease-out ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <JobTable jobs={jobs} />}
    </section>
  );
}
