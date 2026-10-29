// SEAMS server: serves the page with per-result OG tags and renders /og?r=<state> as a PNG.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { analyze, decodeState, PRESETS } = require('./logic.js');
const card = require('./card.js');

const PORT = Number(process.env.PORT || 3010);
const HOST = process.env.HOST || '127.0.0.1';
const ORIGIN = process.env.ORIGIN || 'https://seams.bureauofapplied.science';
const R_RE = /^s-[lb][0-9a-z]{1,700}$/;

const page = fs.readFileSync(path.join(__dirname, 'page.html'), 'utf8');
const sha = s => "'sha256-" + crypto.createHash('sha256').update(s).digest('base64') + "'";
const inline = re => (re.exec(page) || [, ''])[1];
const CSP = [
  "default-src 'none'",
  "script-src " + sha(inline(/<script>([\s\S]*?)<\/script>/)),
  "style-src " + [...page.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => sha(m[1])).join(' '),
  "style-src-attr 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ');
const SEC = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DEFAULT_TITLE = 'SEAMS: how many seams are holding your software together?';
const DEFAULT_DESC = 'Software rarely fails inside a tool. It fails in the gap between two of them. Tap what you run and get your seam load, the failure points that matter, and a card to show your team.';

function meta(title, desc, url, image) {
  return [
    '<meta name="description" content="' + esc(desc) + '">',
    '<link rel="canonical" href="' + esc(url) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="SEAMS by Bureau of Applied Science">',
    '<meta property="og:title" content="' + esc(title) + '">',
    '<meta property="og:description" content="' + esc(desc) + '">',
    '<meta property="og:url" content="' + esc(url) + '">',
    '<meta property="og:image" content="' + esc(image) + '">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(title) + '">',
    '<meta name="twitter:description" content="' + esc(desc) + '">',
    '<meta name="twitter:image" content="' + esc(image) + '">'
  ].join('\n');
}

function analyzeParam(r) {
  if (!R_RE.test(r || '')) return null;
  let d = null;
  try { d = decodeState(r); } catch (e) { return null; }
  return d ? analyze(d.sel, d.owner, d.extra) : null;
}

function renderPage(r) {
  const a = analyzeParam(r);
  let title = DEFAULT_TITLE, desc = DEFAULT_DESC, url = ORIGIN + '/', image = ORIGIN + '/og-default.png';
  if (a && a.n) {
    title = 'I scored ' + a.score + '/100 on SEAMS: ' + a.grade;
    desc = a.roast + ' ' + a.n + ' items, ' + a.possible + ' possible seams. Count yours.';
    url = ORIGIN + '/?r=' + r;
    image = ORIGIN + '/og?r=' + r;
  }
  return page.replace('<!--TITLE-->', esc(title)).replace('<!--OG-->', meta(title, desc, url, image));
}

// Cache by state string. Map keeps insertion order, so deleting the first key is a cheap LRU.
const CACHE_MAX = 500;
const cache = new Map();
const inflight = new Map();
let defaultPng = null;
async function ogFor(r) {
  const a = analyzeParam(r);
  if (!a || !a.n) return defaultPng || (defaultPng = await card.renderDefault());
  if (cache.has(r)) { const v = cache.get(r); cache.delete(r); cache.set(r, v); return v; }
  if (!inflight.has(r)) {
    inflight.set(r, card.renderScore(a).then(buf => {
      cache.set(r, buf);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
      return buf;
    }).finally(() => inflight.delete(r)));
  }
  return inflight.get(r);
}

// First-party event counter. One JSON line per event: hour, event name, grade, preset id. No IP, no stack, no
// identifier. The IP is used only to throttle and is never written down.
const EVENTS_FILE = process.env.EVENTS_FILE || path.join(__dirname, 'data', 'events.ndjson');
fs.mkdirSync(path.dirname(EVENTS_FILE), { recursive: true });
const EVENT_NAMES = new Set(['preset', 'assessed', 'copy_text', 'copy_link', 'save_image', 'share', 'cta_main', 'cta_mid', 'cta_mail']);
const GRADES = new Set(['', 'sound', 'stitched', 'taped', 'loadbearing', 'critical']);
const PRESET_IDS = new Set(['', ...Object.keys(PRESETS)]);
const BEACON_MAX_BYTES = 512;
const RATE_PER_MINUTE = 60;
const rates = new Map();

function throttled(ip) {
  const now = Date.now();
  if (rates.size > 5000) rates.clear();
  const r = rates.get(ip);
  if (!r || now > r.reset) { rates.set(ip, { n: 1, reset: now + 60000 }); return false; }
  return ++r.n > RATE_PER_MINUTE;
}

function recordEvent(raw) {
  let m;
  try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;
  const e = m.e, g = m.g === undefined ? '' : m.g, pr = m.p === undefined ? '' : m.p;
  if (!EVENT_NAMES.has(e) || !GRADES.has(g) || !PRESET_IDS.has(pr)) return;
  const hour = new Date().toISOString().slice(0, 13);
  fs.appendFile(EVENTS_FILE, JSON.stringify({ t: hour, e, g, p: pr }) + '\n', err => { if (err) console.error(err); });
}

function handleBeacon(req, res) {
  const origin = req.headers.origin;
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const sameOrigin = !origin || origin === ORIGIN;
  let body = '', size = 0, over = false;
  req.on('data', c => {
    size += c.length;
    if (size > BEACON_MAX_BYTES) { over = true; req.destroy(); return; }
    body += c;
  });
  req.on('end', () => {
    if (sameOrigin && !over && !throttled(ip)) recordEvent(body);
    res.writeHead(204, SEC);
    res.end();
  });
  req.on('error', () => {});
}

const TYPES = { '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
function send(res, code, type, body, extra) {
  res.writeHead(code, Object.assign({ 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) }, SEC, extra));
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, ORIGIN);
    const p = u.pathname;
    if (req.method === 'POST' && p === '/b') return handleBeacon(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain', 'Method not allowed', { Allow: 'GET, HEAD' });
    if (p === '/') {
      return send(res, 200, 'text/html; charset=utf-8', renderPage(u.searchParams.get('r')), { 'Cache-Control': 'public, max-age=300' });
    }
    if (p === '/og' || p === '/og-default.png') {
      const buf = await ogFor(p === '/og' ? u.searchParams.get('r') : null);
      return send(res, 200, 'image/png', buf, { 'Cache-Control': 'public, max-age=604800' });
    }
    if (/^\/fonts\/[a-z0-9-]+\.woff2$/.test(p)) {
      const f = path.join(__dirname, 'fonts', path.basename(p));
      if (fs.existsSync(f)) return send(res, 200, TYPES['.woff2'], fs.readFileSync(f), { 'Cache-Control': 'public, max-age=31536000, immutable' });
    }
    if (p === '/robots.txt') return send(res, 200, TYPES['.txt'], 'User-agent: *\nAllow: /\n', { 'Cache-Control': 'public, max-age=86400' });
    send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  } catch (e) {
    console.error(e);
    send(res, 500, 'text/plain; charset=utf-8', 'Server error');
  }
});

server.listen(PORT, HOST, () => console.log('seams listening on ' + HOST + ':' + PORT));
