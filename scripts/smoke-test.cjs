/* eslint-disable no-console */
const http = require('http');

const BASE = process.env.SMOKE_BASE || 'http://localhost:4500';

function request(method, urlPath, body) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, BASE);
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        agent: false,
        headers: {
          'content-type': 'application/json',
          connection: 'close',
          ...(data ? { 'content-length': Buffer.byteLength(data) } : {}),
        },
        timeout: 8000,
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => resolve({ status: res.statusCode, body: chunks.slice(0, 200) }));
      }
    );
    req.on('error', (err) => resolve({ status: 0, body: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, body: 'timeout' });
    });
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const spec = await new Promise((resolve, reject) => {
    http.get(`${BASE}/docs.json`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(JSON.parse(body)));
      res.on('error', reject);
    });
  });

  const entries = [];
  for (const [pathname, ops] of Object.entries(spec.paths)) {
    for (const method of Object.keys(ops)) {
      entries.push({ method: method.toUpperCase(), path: pathname });
    }
  }

  const results = {
    ok: [],
    appNotFound: [],
    routeMissing: [],
    appServerErr: [],
    unhandledServerErr: [],
    unreachable: [],
  };
  for (const { method, path: p } of entries) {
    const r = await request(method, p, method === 'GET' ? null : {});
    const tag = `${method.padEnd(6)} ${p}  →  ${r.status}`;
    let isJson = false;
    let parsed = null;
    try {
      parsed = JSON.parse(r.body || '{}');
      isJson = true;
    } catch (_) {}

    if (r.status === 0) results.unreachable.push(tag);
    else if (r.status === 404) {
      const looksLikeRouteMiss =
        isJson && typeof parsed?.message === 'string' && parsed.message.startsWith('Route not found');
      if (looksLikeRouteMiss) results.routeMissing.push(`${tag}  ${r.body}`);
      else results.appNotFound.push(`${tag}  ${r.body.slice(0, 90)}`);
    } else if (r.status >= 500) {
      const looksUnhandled =
        isJson &&
        typeof parsed?.message === 'string' &&
        ['Something went wrong, please try again later', 'Internal Server Error'].includes(
          parsed.message
        );
      if (looksUnhandled) results.unhandledServerErr.push(`${tag}  ${r.body}`);
      else results.appServerErr.push(`${tag}  ${r.body.slice(0, 90)}`);
    } else if (r.status >= 200 && r.status < 500) results.ok.push(tag);
  }

  const summary = (label, arr) => {
    console.log(`\n=== ${label} (${arr.length}) ===`);
    arr.forEach((line) => console.log(line));
  };

  summary('Routed (2xx/3xx/4xx)', results.ok);
  summary('App-level 404 (route ran, said "not found")', results.appNotFound);
  summary('App-level 5xx (controller responded with 500)', results.appServerErr);
  summary('UNHANDLED 5xx (uncaught exception in handler)', results.unhandledServerErr);
  summary('Route truly missing (404 from notFoundHandler)', results.routeMissing);
  summary('Unreachable', results.unreachable);

  console.log('\n--------- TOTAL ---------');
  console.log(`Total endpoints                  : ${entries.length}`);
  console.log(`Working (any controller response): ${results.ok.length + results.appNotFound.length + results.appServerErr.length}`);
  console.log(`  - 2xx/3xx/4xx                  : ${results.ok.length}`);
  console.log(`  - app-level 404                : ${results.appNotFound.length}`);
  console.log(`  - app-level 5xx                : ${results.appServerErr.length}`);
  console.log(`Bugs (unhandled 5xx)             : ${results.unhandledServerErr.length}`);
  console.log(`Bugs (route missing)             : ${results.routeMissing.length}`);
  console.log(`Bugs (unreachable)               : ${results.unreachable.length}`);
})();
