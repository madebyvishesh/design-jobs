import type { Job } from '../types/job';
import { listedPlaces } from './listingText';

export const arrangements = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  unknown: 'Unspecified',
};
export const employmentTypes = {
  full: 'Full-time',
  part: 'Part-time',
  contract: 'Contract',
  intern: 'Internship',
  unknown: 'Unspecified',
};
export const payPeriods = {
  year: 'year',
  month: 'month',
  week: 'week',
  day: 'day',
  hour: 'hour',
} as const;

export function arrangementOf(job: Job): keyof typeof arrangements {
  const value = job.workplace?.toLowerCase().replace(/[\s_-]/g, '');
  if (value === 'remote' || value === 'telecommute') return 'remote';
  if (value === 'hybrid') return 'hybrid';
  if (value === 'onsite' || value === 'inoffice') return 'onsite';
  const wording = job.title + ' ' + job.location;
  if (/\bhybrid\b/i.test(wording)) return 'hybrid';
  if (job.isRemote) return 'remote';
  return /\bon[- ]site\b/i.test(wording) ? 'onsite' : 'unknown';
}
export function employmentOf(job: Job): (keyof typeof employmentTypes)[] {
  const value = (job.employment || job.title).replace(/[_-]/g, ' ');
  const types: (keyof typeof employmentTypes)[] = [];
  if (/\bfull\s*time\b/i.test(value)) types.push('full');
  if (/\bpart\s*time\b/i.test(value)) types.push('part');
  if (/\b(contract(?:or)?|freelance)\b/i.test(value)) types.push('contract');
  if (/\bintern(?:ship)?\b/i.test(value)) types.push('intern');
  return types.length ? types : ['unknown'];
}

export function locationNames(job: Job) {
  const names = new Set<string>();
  for (const part of listedPlaces(job.location)) {
    if (/\b(remote|worldwide|work\s+(?:at|from)\s+home|wfh)\b/i.test(part)) continue;
    const tokens = part
      .replace(/\s*[(-]\s*(?:hybrid|on[- ]?site|HQ)\)?$/i, '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    for (const name of [tokens[0], tokens.length > 1 ? tokens[tokens.length - 1] : '']) {
      if (!name || /^(blank|all|anywhere|unknown|unspecified|n\/a)$/i.test(name)) continue;
      const canonical = /^(?:US|USA|United States of America)$/i.test(name)
        ? 'United States'
        : /^bangalore$/i.test(name)
          ? 'Bengaluru'
          : name;
      if (canonical.length > 2) names.add(canonical);
    }
  }
  return Array.from(names);
}

// Only ranges with an explicit currency and pay period can support a target.
export function payBands(salary = '') {
  const bands: { currency: string; period: string; max: number }[] = [];
  const amount = '(\\d[\\d,]*(?:\\.\\d+)?)';
  const structured = new RegExp(
    '\\b([A-Z]{3})\\s+' +
      amount +
      '(?:\\s*[-–—]\\s*' +
      amount +
      ')?\\s*\\/\\s*(year|month|week|day|hour)\\b',
    'gi',
  );
  for (const m of Array.from(salary.matchAll(structured))) {
    bands.push({
      currency: m[1].toUpperCase(),
      period: m[4].toLowerCase(),
      max: Number((m[3] || m[2]).replace(/,/g, '')),
    });
  }
  for (const segment of salary.split(/\s+\/\s+/)) {
    const range = segment.match(
      /[$€£¥]?([\d,]+(?:\.\d+)?)\s*[-–—]\s*[$€£¥]?([\d,]+(?:\.\d+)?)\s+([A-Z]{3})\b/,
    );
    const unit = segment.match(
      /\b(annual(?:ly)?|year(?:ly)?|month(?:ly)?|week(?:ly)?|daily|day|hour(?:ly)?)\b/i,
    );
    if (range && unit) {
      const period = unit[1]
        .toLowerCase()
        .replace(/^annual.*$/, 'year')
        .replace(/^daily$/, 'day')
        .replace(/ly$/, '');
      bands.push({ currency: range[3], period, max: Number(range[2].replace(/,/g, '')) });
    }
  }
  return bands;
}
