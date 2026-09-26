import http from 'node:http';
import https from 'node:https';
import {networkInterfaces} from 'node:os';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {loadEnv, config} from './server/env.js';
import {scrapeEvents} from './server/event-scraper.js';
import {proposeEvents} from './server/proposals.js';

loadEnv();
const settings = config();
const root = resolve('.');
const PUBLIC_DIRS = ['/src/', '/public/', '/index.html', '/manifest.webmanifest'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

function sendJson(res, status, body) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(body));
}

async function handleApi(url, res) {
  const q = url.searchParams;
  const lat = Number(q.get('lat')), lng = Number(q.get('lng'));
  try {
    if (url.pathname === '/api/status') {
      return sendJson(res, 200, {ai: !!settings.apiKey, model: settings.model});
    }
    if (url.pathname === '/api/events') {
      const started = Date.now();
      const result = await scrapeEvents({lat, lng, from: q.get('from'), to: q.get('to'), refresh: q.get('refresh') === '1'}, settings);
      console.log(`[events] ${result.city || `${lat},${lng}`} ${result.from}…${result.to}: ${result.events.length} events${result.cached ? ' (cache)' : ` in ${((Date.now() - started) / 1000).toFixed(0)}s`}`);
      return sendJson(res, 200, result);
    }
    if (url.pathname === '/api/proposals') {
      return sendJson(res, 200, await proposeEvents({lat, lng}, settings));
    }
    sendJson(res, 404, {error: 'Unknown API route'});
  } catch (error) {
    console.error(`[api] ${url.pathname}: ${error.message}`);
    sendJson(res, error.status && error.status < 500 ? error.status : error.status || 502, {error: error.message, code: error.code || 'failed'});
  }
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return handleApi(url, res);
  try {
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = resolve(root, '.' + pathname);
    if (!file.startsWith(root + sep) || !PUBLIC_DIRS.some(dir => pathname.startsWith(dir))) {
      res.writeHead(404).end('Not found');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache'});
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

const lanAddresses = () => Object.values(networkInterfaces()).flat()
  .filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);

// Phones only allow geolocation on HTTPS (or localhost). A self-signed
// certificate is enough for a local demo: accept the warning once on the phone.
async function certificate() {
  const path = '.cache/cert.json';
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    const selfsigned = await import('selfsigned');
    const generate = selfsigned.generate || selfsigned.default.generate;
    const altNames = [{type: 2, value: 'localhost'}, ...['127.0.0.1', ...lanAddresses()].map(ip => ({type: 7, ip}))];
    const pems = await generate([{name: 'commonName', value: 'out-there.local'}], {
      days: 365, keySize: 2048, extensions: [{name: 'subjectAltName', altNames}],
    });
    await mkdir('.cache', {recursive: true});
    await writeFile(path, JSON.stringify({key: pems.private, cert: pems.cert}));
    return {key: pems.private, cert: pems.cert};
  }
}

http.createServer(handle).listen(settings.port, '0.0.0.0', async () => {
  console.log('\n  Out There is running\n');
  console.log(`  Laptop:  http://localhost:${settings.port}`);
  try {
    const credentials = await certificate();
    https.createServer(credentials, handle).listen(settings.httpsPort, '0.0.0.0', () => {
      for (const ip of lanAddresses()) console.log(`  Phone:   https://${ip}:${settings.httpsPort}   (same Wi-Fi, accept the certificate warning once)`);
      printStatus();
    });
  } catch (error) {
    for (const ip of lanAddresses()) console.log(`  Phone:   http://${ip}:${settings.port}   (no HTTPS: ${error.message}; location falls back to Madison)`);
    printStatus();
  }
});

function printStatus() {
  console.log(settings.apiKey
    ? `\n  AI event scraper: on (${settings.model})\n`
    : '\n  AI event scraper: off. Add ANTHROPIC_API_KEY to .env to load real events.\n');
}
