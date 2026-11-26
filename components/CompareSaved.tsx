'use client';
import { useRef, useState } from 'react';
import type { Job } from '@/types/job';
import { experienceLevel, levels } from '@/lib/discoveryFilters';
import { arrangements, arrangementOf, employmentTypes, employmentOf } from '@/lib/workFilters';
import BoardSelect from './BoardSelect';

export default function CompareSaved({ jobs }: { jobs: Job[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pair, setPair] = useState<string[]>([]);
  const [left, right] = pair.map((id) => jobs.find((j) => j.id === id));
  if (jobs.length < 2) return null;
  const labels = new Map<string, string>();
  const titles = new Set<string>();
  const repeated = new Set<string>();
  for (const job of jobs) {
    const title = job.company + ' · ' + job.title;
    if (titles.has(title)) repeated.add(title);
    titles.add(title);
    labels.set(job.id, title);
  }
  for (const job of jobs) {
    const title = labels.get(job.id)!;
    if (repeated.has(title)) labels.set(job.id, (job.location || job.id) + ' · ' + title);
  }
  function pick(index: number, id: string) {
    setPair((old) => old.map((v, i) => (index === i ? id : v)));
  }
  return (
    <>
      <button
        className="board-control"
        onClick={() => {
          setPair(jobs.slice(0, 2).map((j) => j.id));
          dialog.current?.showModal();
        }}
      >
        Compare saved roles
      </button>
      <dialog
        className="compare-dialog"
        ref={dialog}
        aria-labelledby="compare-title"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="compare-inner">
          <div className="sheet-heading">
            <h2 id="compare-title">Compare saved roles</h2>
            <button onClick={() => dialog.current?.close()}>Close</button>
          </div>
          {left && right ? (
            <>
              <div className="compare-pair">
                {[left, right].map((job, i) => (
                  <BoardSelect
                    key={i}
                    id={'compare-' + i}
                    label={i ? 'Second role' : 'First role'}
                    value={job.id}
                    options={jobs
                      .filter((j) => j.id !== pair[1 - i])
                      .map((j) => ({ value: j.id, label: labels.get(j.id)! }))}
                    onChange={(id) => pick(i, id)}
                  />
                ))}
              </div>
              <dl>
                {[
                  ['Listed pay', left.salary, right.salary],
                  ['Location', left.location, right.location],
                  [
                    'Work arrangement',
                    arrangements[arrangementOf(left)],
                    arrangements[arrangementOf(right)],
                  ],
                  [
                    'Employment type',
                    employmentOf(left)
                      .map((t) => employmentTypes[t])
                      .join(' / '),
                    employmentOf(right)
                      .map((t) => employmentTypes[t])
                      .join(' / '),
                  ],
                  [
                    'Experience',
                    levels[experienceLevel(left.title)],
                    levels[experienceLevel(right.title)],
                  ],
                  [
                    'Listing date',
                    ...[left, right].map((j) =>
                      j.postedAt ? (j.dateKind || 'posted') + ' ' + j.postedAt.slice(0, 10) : '',
                    ),
                  ],
                ].map(([field, a, b]) => (
                  <div key={field}>
                    <dt>{field}</dt>
                    <dd>
                      <span className="sr-only">First role, {left.company}: </span>
                      {a || 'Not listed'}
                    </dd>
                    <dd>
                      <span className="sr-only">Second role, {right.company}: </span>
                      {b || 'Not listed'}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p>A selected role was removed from Saved.</p>
          )}
        </div>
      </dialog>
    </>
  );
}
