import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { readPublisherSnapshot, setCachedJobs, type JobsPayload } from '../lib/jobsCache';

test('a second publisher, failed read or total outage cannot erase a good publication', async t => {
  const initial: JobsPayload = { aiJobs: [], allJobs: [], fetchedAt: Date.parse('2026-11-26'),
    report: [{source:'ashby',board:'studio',domain:'studio.test',status:'ok',received:0}] };
  let stored: JobsPayload | null = null;
  let version = 0;
  let brokenRead = false;
  let writes = 0;
  let address = '';
  const server = createServer(async (req,res) => {
    const etag = 'version-' + version;
    function reply(status: number, data: unknown) {
      res.writeHead(status, {'Content-Type':'application/json',etag});
      res.end(JSON.stringify(data));
    }
    if (req.method === 'PUT') {
      if (stored && req.headers['x-if-match'] !== etag) {
        reply(412,{error:{code:'precondition_failed'}});
        return;
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      stored = JSON.parse(Buffer.concat(chunks).toString());
      writes++;
      version++;
      reply(200,{url:address+'/snapshot',pathname:'design-jobs-cache.json'});
    } else if (!stored) {
      reply(404,{error:{code:'not_found'}});
    } else if (req.url?.startsWith('/snapshot')) {
      reply(brokenRead ? 503 : 200, stored);
    } else {
      reply(200,{url:address+'/snapshot',etag});
    }
  });
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  address = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  const oldUrl = process.env.VERCEL_BLOB_API_URL;
  const oldToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.VERCEL_BLOB_API_URL = address;
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_dummy';
  t.after(async () => {
    if (oldUrl === undefined) delete process.env.VERCEL_BLOB_API_URL; else process.env.VERCEL_BLOB_API_URL = oldUrl;
    if (oldToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = oldToken;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  assert.equal(await readPublisherSnapshot(),null);
  await setCachedJobs(initial,null);
  const first = await readPublisherSnapshot();
  const second = await readPublisherSnapshot();
  assert.ok(first && second);
  const winner = await setCachedJobs({...initial,fetchedAt:initial.fetchedAt+1},second);
  assert.deepEqual(await setCachedJobs({...initial,fetchedAt:initial.fetchedAt+2},first),winner);
  await assert.rejects(setCachedJobs({...initial,report:[]},first),/No board/);
  brokenRead = true;
  await assert.rejects(readPublisherSnapshot(),/503/);
  assert.equal(writes,2);
});
