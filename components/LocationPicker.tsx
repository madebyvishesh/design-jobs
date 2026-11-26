'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { countries } from '@/lib/discoveryFilters';
import type { BrowseCriteria } from '@/lib/browseParams';

type Props = {
  criteria: BrowseCriteria;
  places: string[];
  change: (patch: Partial<BrowseCriteria>) => void;
  count: (patch: Partial<BrowseCriteria>) => number;
};
function fold(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/bangalore/g, 'bengaluru');
}
export default function LocationPicker({ criteria, places, change, count }: Props) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('');
  const [limits, setLimits] = useState<Record<string, number>>({});
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const name = countries.find((c) => c.value === criteria.country)?.label;
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    function outside(e: Event) {
      // WebKit briefly focuses the enclosing dialog before dispatching a touch click.
      if (e.type === 'focusin' && e.target === root.current?.closest('dialog')) return;
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open]);
  const term = fold(query.trim());
  const groups = [
    {
      label: 'Listed location',
      options: places.map((city) => ({
        name: city,
        key: city,
        patch: { city, country: '', unspecified: false },
      })),
    },
    {
      label: 'Remote from',
      options: countries.map((c) => ({
        name: c.label,
        key: c.value,
        patch: { country: c.value, city: '', remote: true, arrangement: '', unspecified: false },
      })),
    },
  ];
  return (
    <div
      className="filter-field field-picker"
      ref={root}
      onKeyDown={(e) => {
        if (open && e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        if (open && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
          const items = Array.from(
            root.current!.querySelectorAll<HTMLElement>('.location-options button'),
          );
          const i = items.indexOf(document.activeElement as HTMLElement);
          e.preventDefault();
          const next =
            i < 0
              ? e.key === 'ArrowDown'
                ? 0
                : items.length - 1
              : (i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
          items[next]?.focus();
        }
      }}
    >
      <label htmlFor="location-filter">Location</label>
      <button
        ref={trigger}
        id="location-filter"
        className="board-select-trigger"
        aria-expanded={open}
        aria-controls={open ? 'location-menu' : undefined}
        onClick={() => {
          trigger.current?.focus({ preventScroll: true });
          setQuery('');
          setLimits({});
          setOpen(!open);
        }}
      >
        <span>{name ? 'Remote from ' + name : criteria.city || 'Any location'}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="field-options location-options" id="location-menu">
          <div className="location-search">
            <Search size={15} aria-hidden="true" />
            <input
              aria-label="Find a city or country"
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Find a city or country"
              value={query}
              onChange={(e) => {
                if (results.current) results.current.scrollTop = 0;
                setQuery(e.target.value);
                setLimits({});
              }}
            />
          </div>
          <div className="location-results" ref={results}>
            <button
              onClick={() => {
                change({ city: '', country: '', unspecified: false });
                close();
              }}
            >
              Any location
            </button>
            {groups.map((group) => {
              const filtered = group.options
                .filter((o) => fold(o.name).includes(term) || fold(o.key) === term)
                .sort((a, b) => Number(fold(b.name) === term) - Number(fold(a.name) === term));
              const limit = limits[group.label] || 10;
              return (
                filtered.length > 0 && (
                  <div key={group.label}>
                    <p>{group.label}</p>
                    {filtered.slice(0, limit).map((o) => (
                      <LocationOption
                        key={o.key}
                        name={o.name}
                        count={() => count(o.patch)}
                        onChoose={() => {
                          change(o.patch);
                          close();
                        }}
                      />
                    ))}
                    {filtered.length > limit && (
                      <button
                        type="button"
                        onClick={() => setLimits((prev) => ({ ...prev, [group.label]: limit + 20 }))}
                      >
                        More {group.label === 'Remote from' ? 'remote countries' : 'locations'}
                      </button>
                    )}
                  </div>
                )
              );
            })}
            {!groups.some((g) =>
              g.options.some((o) => fold(o.name).includes(term) || fold(o.key) === term),
            ) && <p role="status">No matching location</p>}
          </div>
        </div>
      )}
    </div>
  );
}
// Mount counts only for an open menu. Counts use the same query as the results.
function LocationOption({
  name,
  count,
  onChoose,
}: {
  name: string;
  count: () => number;
  onChoose: () => void;
}) {
  return (
    <button type="button" onClick={onChoose}>
      {name}
      <span>{count()}</span>
    </button>
  );
}
