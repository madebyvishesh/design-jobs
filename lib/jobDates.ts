import type { Job } from '../types/job';

type ListingDate = Required<Pick<Job, 'postedAt' | 'dateKind' | 'dateSource'>>;

export function classifyDate(job: Job, fresh = false): ListingDate {
  const dateSource = job.dateSource ?? job.ats;
  // Old merged snapshots lost date provenance, and old Remotive rows could use fetch time.
  const ambiguous = !fresh && (job.sources.length > 1 || dateSource === 'remotive');
  let dateKind = job.dateKind;
  if (!dateKind) {
    if (ambiguous || dateSource === 'yc') dateKind = 'unknown';
    else if (dateSource === 'lever') dateKind = 'created';
    else dateKind = dateSource === 'greenhouse' ? 'updated' : 'posted';
  }
  // Some providers omit the zone. Normalize on ingestion so every browser sorts identically.
  const raw = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(job.postedAt)
    ? job.postedAt.replace(' ', 'T') + 'Z'
    : job.postedAt;
  const time = Date.parse(raw);
  if (!Number.isFinite(time) || time < Date.UTC(2000, 0) || dateKind === 'unknown') {
    return { postedAt: '', dateKind: 'unknown', dateSource };
  }
  return { postedAt: new Date(time).toISOString(), dateKind, dateSource };
}

export function preferredDate(a: Job, b: Job): ListingDate {
  const first = classifyDate(a);
  const second = classifyDate(b);
  const rank = { posted: 3, updated: 2, created: 1, unknown: 0 };
  if (first.dateKind !== second.dateKind) return rank[first.dateKind] > rank[second.dateKind] ? first : second;
  if (first.dateKind === 'updated') return first.postedAt > second.postedAt ? first : second;
  return first.postedAt <= second.postedAt ? first : second;
}
