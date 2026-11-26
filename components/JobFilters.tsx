'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fields } from '@/lib/jobFields';
import { levels } from '@/lib/discoveryFilters';
import { arrangements, employmentTypes, payPeriods } from '@/lib/workFilters';
import { columns, sortLabel, sources, type SortKey, type BrowseCriteria } from '@/lib/browseParams';
import FieldPicker from './FieldPicker';
import BoardSelect from './BoardSelect';
import LocationPicker from './LocationPicker';

interface Props {
  criteria: BrowseCriteria;
  phone: boolean;
  currencies: string[];
  places: string[];
  hasApplied: boolean;
  details: boolean;
  hiddenOnly: boolean;
  hiddenCount: number;
  hasSearch: boolean;
  count: (state: BrowseCriteria, hiddenOnly: boolean) => number;
  apply: (state: BrowseCriteria, details: boolean, hiddenOnly: boolean) => void;
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
  details,
  hiddenOnly,
  hiddenCount,
  hasSearch,
  count,
  apply,
  close,
  children,
}: Props) {
  const [draft, setDraft] = useState(criteria);
  const [draftDetails, setDraftDetails] = useState(details);
  const [draftHidden, setDraftHidden] = useState(hiddenOnly);
  const showDetails = phone ? draftDetails : details;
  const showHidden = phone ? draftHidden : hiddenOnly;
  const c = phone ? draft : criteria;
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    if (!phone) return;
    const element = dialog.current!;
    const shell = element.closest<HTMLElement>('.board-shell');
    const previousWidth = document.documentElement.clientWidth;
    element.showModal();
    // WebKit can release the scrollbar gutter when the document locks.
    const released = document.documentElement.clientWidth - previousWidth;
    if (released > 0) shell?.style.setProperty('--sheet-gutter', released + 'px');
    return () => {
      element.close();
      shell?.style.removeProperty('--sheet-gutter');
    };
  }, [phone]);
  function change(patch: Partial<BrowseCriteria>, nextDetails = showDetails, nextHidden = showHidden) {
    const next = Object.keys(patch).length ? { ...c, ...patch } : c;
    if (phone) {
      setDraft(next);
      setDraftDetails(nextDetails);
      setDraftHidden(nextHidden);
    } else apply(next, nextDetails, nextHidden);
  }
  const totals = useMemo(() => {
    const fieldCounts: Record<string, number> = {},
      levelCounts: Record<string, number> = {};
    for (const field of ['all', ...Object.keys(fields)])
      fieldCounts[field] = count({ ...c, field }, showHidden);
    for (const level of ['all', ...Object.keys(levels)])
      levelCounts[level] = count({ ...c, level }, showHidden);
    return { fieldCounts, levelCounts };
  }, [c, count, showHidden]);
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
          count={(patch) => count({ ...c, ...patch }, showHidden)}
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
          <BoardSelect
            id="sort-order"
            label="Sort by"
            value={hasSearch && !c.explicitSort ? 'best' : c.sortKey + (c.ascending ? '+' : '-')}
            options={[
              ...(hasSearch ? [{ value: 'best', label: 'Best match' }] : []),
              ...(Object.keys(columns) as SortKey[]).flatMap((key) =>
                (key === 'postedAt' ? ['-', '+'] : ['+', '-']).map((dir) => ({
                  value: key + dir,
                  label: sortLabel(key, dir === '+'),
                })),
              ),
            ]}
            onChange={(value) =>
              change(
                value === 'best'
                  ? { explicitSort: false, sortKey: 'postedAt', ascending: false }
                  : {
                      explicitSort: true,
                      sortKey: value.slice(0, -1) as SortKey,
                      ascending: value.endsWith('+'),
                    },
              )
            }
          />
          <div className="filter-toggles display-toggles">
            <label>
              <input
                type="checkbox"
                checked={showDetails}
                onChange={(e) => change({}, e.target.checked)}
              />
              Show job details
            </label>
            {hiddenCount > 0 && (
              <label>
                <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={(e) => change({ scope: 'All roles' }, showDetails, e.target.checked)}
                />
                View hidden roles ({hiddenCount})
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
  const n = count(draft, showHidden);
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
              apply(draft, showDetails, showHidden);
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
