import { decodeHTMLStrict } from 'entities';
import type { Job } from '../types/job';

export function normalizeListing(job: Job): Job {
  function clean(value: string) {
    return value?.includes('&') ? decodeHTMLStrict(value) : value;
  }
  const location = clean(job.location);
  const homeBased = listedPlaces(location || '').some(part=>/^(?:work\s+(?:from|at)\s+home|WFH)(?:$|[,: –-])/i.test(part));
  return { ...job, title: clean(job.title), location, isRemote:job.isRemote || homeBased, company: clean(job.company),
    department: clean(job.department), salary: job.salary && clean(job.salary) };
}

// Commas commonly join a city, state and country within a single location.
export function listedPlaces(location: string) {
  return Array.from(new Set(location.split(/\s*[·;|]\s*|\s+\/\s+/).map(part => part.trim()).filter(Boolean)));
}
