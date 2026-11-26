'use client';

import { useEffect, useRef, useState } from 'react';
import type { Job } from '@/types/job';

type Entry = { note?: string; job?: Job; applied: boolean };
type Shortlist = Record<string, Entry>;
const KEY = 'design-jobs:shortlist:v1';

function readShortlist(): Shortlist {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const value = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const entries: Shortlist = {};
      for (const [id, item] of Object.entries(value)) {
        if (!item || typeof item !== 'object' || !('applied' in item) || typeof item.applied !== 'boolean') continue;
        const job = 'job' in item ? item.job as Job | undefined : undefined;
        const valid = job && job.id === id && [job.title, job.company, job.location, job.postedAt, job.url].every(v => typeof v === 'string') && /^https?:\/\//i.test(job.url);
        entries[id] = { note: 'note' in item && typeof item.note==='string' ? item.note : undefined, applied: item.applied, job: valid ? job : undefined };
      }
      return entries;
    }
  }
  const legacy = JSON.parse(localStorage.getItem('design-jobs:saved') ?? '[]');
  return Object.fromEntries((Array.isArray(legacy) ? legacy : []).filter(id => typeof id === 'string').map(id => [id, { applied: false }]));
}

export function useShortlist(jobs: Job[]) {
  const [entries, setEntries] = useState<Shortlist>({});
  const memory = useRef<Shortlist>({});
  const temporary = useRef(false);
  function store(next: Shortlist) {
    memory.current = next;
    setEntries(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); temporary.current = false; return true; }
    catch { temporary.current = true; return false; }
  }
  function current() {
    try { return temporary.current ? memory.current : readShortlist(); }
    catch { return memory.current; }
  }
  useEffect(() => {
    function sync() {
      const next = current();
      let changed = false;
      for (const job of jobs) {
        if (Object.hasOwn(next, job.id) && JSON.stringify(next[job.id].job) !== JSON.stringify(job)) {
          next[job.id] = { ...next[job.id], job };
          changed = true;
        }
      }
      if (changed) store({ ...next });
      else { memory.current = next; setEntries({ ...next }); }
    }
    function update(event: StorageEvent) { if (!event.key || event.key === KEY || event.key === 'design-jobs:saved') sync(); }
    sync();
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, [jobs]);

  function toggle(job: Job) {
    const next = { ...current() };
    const adding = !Object.hasOwn(next, job.id);
    if (adding) next[job.id] = { job, applied: false };
    else delete next[job.id];
    return { adding, persisted: store(next) };
  }
  function markApplied(job: Job) {
    const next = current();
    if (!Object.hasOwn(next, job.id)) return true;
    return store({ ...next, [job.id]: { ...next[job.id], job, applied: !next[job.id].applied } });
  }
  function saveNote(id:string,note:string) {
    const next = current();
    if (!Object.hasOwn(next,id)) return false;
    return store({...next,[id]:{...next[id],note}});
  }
  return { entries, toggle, markApplied, saveNote };
}

export function usePreviousVisit(fetchedAt: number) {
  const [baseline, setBaseline] = useState<number | null>(null);
  useEffect(() => {
    const key = 'design-jobs:last-visit';
    function observe() {
      if (document.visibilityState === 'hidden') return;
      try {
        const now = Date.now();
        const last = Number(localStorage.getItem(key)) || fetchedAt;
        const visit = JSON.parse(sessionStorage.getItem(key) ?? 'null');
        const since = visit && now - visit.active < 30 * 60 * 1000 && Number.isFinite(visit.since) ? visit.since : last;
        sessionStorage.setItem(key, JSON.stringify({ since, active: now }));
        localStorage.setItem(key, String(Math.max(last, fetchedAt)));
        setBaseline(since);
      } catch { /* The board still works without a visit history. */ }
    }
    observe();
    document.addEventListener('visibilitychange', observe);
    return () => document.removeEventListener('visibilitychange', observe);
  }, [fetchedAt]);
  return baseline;
}
