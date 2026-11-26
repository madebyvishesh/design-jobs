'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fields } from '@/lib/jobFields';
import { levels } from '@/lib/discoveryFilters';
import { arrangements, employmentTypes, payPeriods } from '@/lib/workFilters';
import { sources, type BrowseCriteria } from '@/lib/browseParams';
import FieldPicker from './FieldPicker';
import BoardSelect from './BoardSelect';
import LocationPicker from './LocationPicker';

interface Props {
  criteria: BrowseCriteria;
  phone: boolean;
  currencies: string[];
  places: string[];
  hasApplied: boolean;
  count: (state: BrowseCriteria) => number;
  apply: (state: BrowseCriteria) => void;
  close: () => void;
  children: (c: BrowseCriteria) => React.ReactNode;
}
const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));
export default function JobFilters({
  criteria,
  phone,
  currencies,
  places,
  hasApplied,
  count,
  apply,
  close,
  children,
}: Props) {
  const [draft, setDraft] = useState(criteria);
  const c = phone ? draft : criteria;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!phone) return;
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, [phone]);
  function change(patch: Partial<BrowseCriteria>) {
    const next = { ...c, ...patch };
    if (phone) setDraft(next);
    else apply(next);
  }
  const totals = useMemo(() => {
    const fieldCounts: Record<string, number> = {},
      levelCounts: Record<string, number> = {};
    for (const field of ['all', ...Object.keys(fields)]) fieldCounts[field] = count({ ...c, field });
    for (const level of ['all', ...Object.keys(levels)]) levelCounts[level] = count({ ...c, level });
    return { fieldCounts, levelCounts };
  }, [c, count]);
  const work = c.remote ? 'remote' : c.arrangement || 'all';
  const content = (
    <>
      <div className="primary-filters">
        <FieldPicker
          value={c.field}
          counts={totals.fieldCounts}
          onChange={(field) => change({ field })}
        />
        <LocationPicker
          criteria={c}
          places={places}
          change={change}
          count={(patch) => count({ ...c, ...patch })}
        />
        <FieldPicker
          id="level-filter"
          name="Experience level"
          allLabel="All levels"
          options={levels}
          value={c.level}
          counts={totals.levelCounts}
          onChange={(level) => change({ level })}
        />
      </div>
      <details className="more-filters">
        <summary>
          More filters
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="secondary-filters">
          <BoardSelect
            id="arrangement-filter"
            label="Work arrangement"
            value={work}
            options={[{ value: 'all', label: 'Any arrangement' }, ...options(arrangements)]}
            onChange={(v) =>
              change({
                arrangement: v === 'all' || v === 'remote' ? '' : v,
                remote: v === 'remote',
                country: v === 'remote' ? c.country : '',
                unspecified: v === 'remote' && c.unspecified,
              })
            }
          />
          <BoardSelect
            id="employment-filter"
            label="Employment type"
            value={c.employment || 'all'}
            options={[{ value: 'all', label: 'All types' }, ...options(employmentTypes)]}
            onChange={(v) => change({ employment: v === 'all' ? '' : v })}
          />
          <BoardSelect
            id="portal-filter"
            label="Job portal"
            value={c.source}
            options={[{ value: 'all', label: 'All portals' }, ...options(sources)]}
            onChange={(source) => change({ source })}
          />
          <fieldset className="target-pay">
            <legend className="sr-only">Salary target</legend>
            <div>
              <label>
                Salary target
                <input
                  id="pay-target"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Any amount"
                  value={c.target}
                  onChange={(e) =>
                    change({
                      target:
                        e.target.validity.valid && Number(e.target.value) > 0
                          ? String(e.target.valueAsNumber)
                          : '',
                    })
                  }
                />
              </label>
              <BoardSelect
                id="pay-currency"
                label="Currency"
                value={c.currency}
                options={Array.from(new Set([...currencies, c.currency]))
                  .sort()
                  .map((v) => ({ value: v, label: v }))}
                onChange={(currency) => change({ currency })}
              />
              <BoardSelect
                id="pay-period"
                label="Pay period"
                value={c.period}
                options={options(payPeriods)}
                onChange={(period) => change({ period })}
              />
            </div>
          </fieldset>
          <div className="filter-toggles">
            <label>
              <input
                type="checkbox"
                checked={c.salary}
                onChange={(e) => change({ salary: e.target.checked })}
              />
              Salary listed
            </label>
            <label>
              <input
                type="checkbox"
                checked={c.week}
                onChange={(e) => change({ week: e.target.checked })}
              />
              Posted in the last 7 days
            </label>
            {c.country && (
              <label>
                <input
                  type="checkbox"
                  checked={c.unspecified}
                  onChange={(e) => change({ unspecified: e.target.checked })}
                />
                Include unspecified countries
              </label>
            )}
            {(hasApplied || c.hideApplied) && (
              <label>
                <input
                  type="checkbox"
                  checked={c.hideApplied}
                  onChange={(e) => change({ hideApplied: e.target.checked })}
                />
                Hide applied roles
              </label>
            )}
          </div>
        </div>
      </details>
      {children(c)}
    </>
  );
  if (!phone)
    return (
      <section
        id="board-filters"
        aria-label="Job filters"
        className="board-filters discovery-panel"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !e.defaultPrevented) {
            e.stopPropagation();
            close();
          }
        }}
      >
        {content}
      </section>
    );
  const n = count(draft);
  return (
    <dialog
      ref={dialog}
      id="board-filters"
      className="filter-sheet"
      aria-labelledby="sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className="sheet-inner">
        <div className="sheet-heading">
          <h2 id="sheet-title">Filters</h2>
          <button onClick={close}>Cancel</button>
        </div>
        <div className="sheet-scroll">{content}</div>
        <div className="sheet-footer">
          <button
            className="primary-action"
            onClick={() => {
              apply(draft);
              close();
            }}
          >
            Show {n} {n === 1 ? 'role' : 'roles'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
