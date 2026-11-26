import type { AtsSource, Job } from '@/types/job';

export interface BoardReport {
  source: AtsSource;
  board: string;
  domain: string;
  status: 'ok' | 'missing' | 'unavailable' | 'partial';
  received: number;
  reason?: string;
  feed?: string;
  indexed?: number;
  unverifiedUrls?: string[];
}

export interface BoardListings {
  jobs: Job[];
  feed: string;
  indexed: number;
  incomplete?: string;
  unverifiedUrls?: string[];
}

export class BoardMissing extends Error {}

export function checkBoardResponse(response: Response) {
  if (response.status === 404 || response.status === 410) throw new BoardMissing();
  if (!response.ok) throw new Error('HTTP ' + response.status);
}

function retryAfterMs(header: string | null) {
  if (!header) return undefined;
  if (/^\d+$/.test(header)) return Number(header) * 1000;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

// The deadline covers reading the body. Each page and each retry gets a fresh signal.
export async function readBoardJson<T>(url: string, init: RequestInit = {}, timeout = 20000): Promise<T> {
  const requestHeaders = new Headers(init.headers);
  requestHeaders.set('User-Agent', 'DesignJobs/1.0 (+https://github.com/madebyvishesh/design-jobs)');
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { ...init, headers: requestHeaders, signal: AbortSignal.timeout(timeout) });
      if (response.ok) return await response.json() as T;
    } catch (error) {
      const timedOut = error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name);
      if (!timedOut && !(error instanceof TypeError)) throw error;
      if (attempt > 0) throw new Error(timedOut ? 'Page timed out after one retry' : 'Network error after one retry');
      await new Promise(resolve => setTimeout(resolve, 750));
      continue;
    }
    const { status, headers } = response;
    const retryAfter = retryAfterMs(headers.get('retry-after'));
    const challenge = headers.get('cf-mitigated') === 'challenge';
    await response.body?.cancel();
    if (status === 404 || status === 410) throw new BoardMissing('HTTP ' + status);
    const transient = [429, 502, 503, 504].includes(status);
    const delay = retryAfter ?? (status === 429 ? 5000 : 1000);
    if (!attempt && transient && !challenge && delay <= 12000) {
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    const detail = [
      headers.get('server'), headers.get('content-type')?.split(';')[0],
      challenge && 'challenge', retryAfter !== undefined && 'Retry-After ' + Math.ceil(retryAfter / 1000) + 's',
      attempt > 0 && 'after retry',
    ].filter(Boolean).join(', ');
    throw new Error('HTTP ' + status + (detail ? ' (' + detail + ')' : ''));
  }
}

export async function collectBoards<T>(
  source: AtsSource, boards: T[], identify: (board: T) => { board: string; domain: string },
  fetchBoard: (board: T) => Promise<Job[] | BoardListings>, report: BoardReport[], concurrency = 24,
) {
  let cursor = 0;
  const results: Job[][] = [];
  async function worker() {
    while (cursor < boards.length) {
      const i = cursor++;
      const board = boards[i];
      const meta = { source, ...identify(board) };
      try {
        const result = await fetchBoard(board);
        const feed = Array.isArray(result) ? undefined : result;
        const jobs = Array.isArray(result) ? result : result.jobs;
        results[i] = jobs.map(job => ({ ...job, boardKey: source + ':' + meta.board }));
        report.push({ ...meta, status: feed?.incomplete ? 'partial' : 'ok', received: jobs.length,
          feed: feed?.feed, indexed: feed?.indexed, reason: feed?.incomplete, unverifiedUrls: feed?.unverifiedUrls });
      } catch (error) {
        report.push({ ...meta, status: error instanceof BoardMissing ? 'missing' : 'unavailable',
          received: 0, reason: error instanceof Error ? error.message.slice(0,120) : 'Request failed' });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, boards.length) }, worker));
  return results.flat();
}

// Request until the provider's total is reached or it returns an empty page.
export async function readPages<T>(read: (offset: number) => Promise<{ items: T[]; total?: number }>, key: (item: T) => string) {
  const seen = new Map<string,T>();
  let offset = 0;
  let total: number | undefined;
  for (;;) {
    const page = await read(offset);
    if (!Array.isArray(page.items)) throw new Error('Invalid postings response');
    if (page.total !== undefined && (offset === 0 || page.total > 0)) total = page.total;
    if (!page.items.length) {
      if (total !== undefined && offset < total) throw new Error('Incomplete postings response');
      break;
    }
    const before = seen.size;
    for (const item of page.items) seen.set(key(item), item);
    if (before === seen.size) throw new Error('Provider repeated a postings page');
    offset += page.items.length;
    if (total !== undefined && offset >= total) break;
  }
  return Array.from(seen.values());
}
