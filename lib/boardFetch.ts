import type { AtsSource, Job } from '@/types/job';

export interface BoardReport {
  source: AtsSource;
  board: string;
  domain: string;
  status: 'ok' | 'missing' | 'unavailable';
  received: number;
  reason?: string;
}

export class BoardMissing extends Error {}

export function checkBoardResponse(response: Response) {
  if (response.status === 404 || response.status === 410) throw new BoardMissing();
  if (!response.ok) throw new Error('HTTP ' + response.status);
}

export async function collectBoards<T>(
  source: AtsSource, boards: T[], identify: (board: T) => { board: string; domain: string },
  fetchBoard: (board: T) => Promise<Job[]>, report: BoardReport[],
) {
  let cursor = 0;
  const results: Job[][] = [];
  async function worker() {
    while (cursor < boards.length) {
      const i = cursor++;
      const board = boards[i];
      const meta = { source, ...identify(board) };
      try {
        const jobs = await fetchBoard(board);
        results[i] = jobs.map(job => ({ ...job, boardKey: source + ':' + meta.board }));
        report.push({ ...meta, status: 'ok', received: jobs.length });
      } catch (error) {
        report.push({ ...meta, status: error instanceof BoardMissing ? 'missing' : 'unavailable',
          received: 0, reason: error instanceof Error ? error.message.slice(0,120) : 'Request failed' });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(24, boards.length) }, worker));
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
