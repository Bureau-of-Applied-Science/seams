// Starts the real server on a spare port and checks previews, cards and the event endpoint.
// Run from this directory after `node build.js`: node server-check.js
// Exits 1 on any failed assertion.
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3912;
const BASE = 'http://127.0.0.1:' + PORT;
const ORIGIN = 'https://seams.bureauofapplied.science';
const EVENTS = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'seams-check-')), 'events.ndjson');

// Scores the kit quotes, in outreach_kit.md section 1. They come from seams_check2.js.
const PRESETS = { restaurant: 32, salon: 17, trades: 37, therapist: 17, hotel: 44, store: 53, course: 44, consultancy: 23 };
const NOUN = { restaurant: 'restaurant', salon: 'salon', trades: 'trades', therapist: 'therapy practice', hotel: 'hotel', store: 'online store', course: 'course', consultancy: 'consultancy' };
const STATE = 's-l02040l0x263w67';

let passed = 0, failed = 0;
function eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else { failed++; console.log('FAIL ' + name + '\n  got:  ' + JSON.stringify(got) + '\n  want: ' + JSON.stringify(want)); }
}
const ok = (name, cond, detail) => { eq(name, !!cond, true); if (!cond && detail) console.log('  ' + detail); };

const tag = (html, re) => { const m = re.exec(html); return m ? m[1].replace(/&amp;/g, '&') : null; };
const ogTitle = html => tag(html, /<meta property="og:title" content="([^"]*)"/);
const ogImage = html => tag(html, /<meta property="og:image" content="([^"]*)"/);
const canonical = html => tag(html, /<link rel="canonical" href="([^"]*)"/);
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
const get = async p => { const r = await fetch(BASE + p); return { status: r.status, type: r.headers.get('content-type'), buf: Buffer.from(await r.arrayBuffer()) }; };
const text = async p => { const r = await get(p); return { ...r, html: r.buf.toString('utf8') }; };
const dims = buf => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

// The preset label must replace the footer text and add no other element. Pixels alone cannot tell a stray
// child from a footer, so check the tree the card is rendered from.
function checkCardStructure() {
  const card = require('./card.js');
  const { analyze, PRESETS, ITEMS } = require('./logic.js');
  const sel = new Set();
  ITEMS.forEach(it => { if (PRESETS.restaurant.names.indexOf(it.name) > -1) sel.add(it.idx); });
  const a = analyze(sel, 1, 0);
  const plain = card.scoreTree(a).props.children;
  const labeled = card.scoreTree(a, 'RESTAURANT STACK').props.children;
  const texts = kids => kids.map(k => k.props.children).filter(c => typeof c === 'string');
  eq('a label adds no element', labeled.length, plain.length);
  eq('the label is the last element', labeled[labeled.length - 1].props.children, 'RESTAURANT STACK');
  eq('the label replaces COUNT YOURS', texts(labeled).includes('COUNT YOURS'), false);
  eq('the label appears once', texts(labeled).filter(t => t === 'RESTAURANT STACK').length, 1);
  eq('an unlabeled card keeps COUNT YOURS', texts(plain).includes('COUNT YOURS'), true);
  eq('the label is a child of the frame, not stray text', labeled.every(k => typeof k === 'object' && k.props && k.props.style), true);
}

async function run() {
  checkCardStructure();
  const def = await text('/');
  eq('bare page title', ogTitle(def.html), 'SEAMS: how many seams are holding your software together?');
  eq('bare page image', ogImage(def.html), ORIGIN + '/og-default.png');
  const defaultCard = await get('/og-default.png');
  eq('default card is a 1200x630 png', [defaultCard.status, defaultCard.type, dims(defaultCard.buf)], [200, 'image/png', { w: 1200, h: 630 }]);

  // every preset: its own title, canonical, image URL and a distinct card
  const hashes = new Set([sha(defaultCard.buf)]);
  for (const [id, score] of Object.entries(PRESETS)) {
    const page = await text('/?start=' + id);
    eq(id + ' title', ogTitle(page.html), 'SEAMS scores the ' + NOUN[id] + ' stack it loads at ' + score + ' of 100');
    eq(id + ' canonical', canonical(page.html), ORIGIN + '/?start=' + id);
    eq(id + ' og:image', ogImage(page.html), ORIGIN + '/og?start=' + id);
    ok(id + ' html title matches og:title', page.html.includes('<title>' + ogTitle(page.html).replace(/&/g, '&amp;') + '</title>') || page.html.includes('<title>' + ogTitle(page.html) + '</title>'));
    const img = await get('/og?start=' + id);
    eq(id + ' card is a 1200x630 png', [img.status, img.type, dims(img.buf)], [200, 'image/png', { w: 1200, h: 630 }]);
    hashes.add(sha(img.buf));
    const again = await get('/og?start=' + id);
    eq(id + ' card is stable across requests', sha(again.buf), sha(img.buf));
  }
  // salon and therapist share a score but not a card, since the footer names the stack
  eq('every preset card is distinct from the others and the default', hashes.size, Object.keys(PRESETS).length + 1);

  // bad ids fall back to the generic preview and card
  for (const bad of ['nonsense', 'Restaurant', '..%2Fx', 'restaurant1', '', 'constructor', '__proto__']) {
    const page = await text('/?start=' + bad);
    eq('?start=' + bad + ' falls back', ogImage(page.html), ORIGIN + '/og-default.png');
    const img = await get('/og?start=' + bad);
    eq('/og?start=' + bad + ' returns the default card', sha(img.buf), sha(defaultCard.buf));
  }

  // precedence mirrors the page: ?start= beats ?r=
  const both = await text('/?start=hotel&r=' + STATE);
  eq('?start= beats ?r= in the preview', ogImage(both.html), ORIGIN + '/og?start=hotel');
  const bothImg = await get('/og?start=hotel&r=' + STATE);
  const hotelImg = await get('/og?start=hotel');
  eq('?start= beats ?r= in the card', sha(bothImg.buf), sha(hotelImg.buf));

  // shared results still preview as the sharer's own card
  const shared = await text('/?r=' + STATE);
  ok('shared result title', /^I scored \d+\/100 on SEAMS: [A-Z-]+$/.test(ogTitle(shared.html)), ogTitle(shared.html));
  eq('shared result image', ogImage(shared.html), ORIGIN + '/og?r=' + STATE);
  const sharedImg = await get('/og?r=' + STATE);
  ok('shared card differs from every preset card', !hashes.has(sha(sharedImg.buf)));
  const badR = await text('/?r=garbage');
  eq('bad ?r= falls back', ogImage(badR.html), ORIGIN + '/og-default.png');

  // the page itself is intact and carries the CSP
  const head = await fetch(BASE + '/?start=restaurant');
  ok('csp present', (head.headers.get('content-security-policy') || '').includes("default-src 'none'"));
  ok('page still carries the app', (await head.text()).includes('id="score"'));

  // event endpoint: valid kept, invalid dropped
  const post = body => fetch(BASE + '/b', { method: 'POST', headers: { Origin: ORIGIN }, body });
  eq('valid event accepted', (await post('{"e":"cta_main","g":"taped","p":""}')).status, 204);
  eq('invalid event accepted silently', (await post('{"e":"evil","g":"","p":""}')).status, 204);
  await new Promise(r => setTimeout(r, 300));
  const lines = fs.readFileSync(EVENTS, 'utf8').trim().split('\n').map(JSON.parse);
  eq('only the valid event was written', lines.map(l => l.e), ['cta_main']);
  eq('event line has exactly t, e, g, p', Object.keys(lines[0]), ['t', 'e', 'g', 'p']);
  eq('unknown route is 404', (await get('/nope')).status, 404);
}

const server = spawn(process.execPath, ['server.js'], { cwd: __dirname, env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', EVENTS_FILE: EVENTS } });
let log = '';
server.stdout.on('data', d => { log += d; });
server.stderr.on('data', d => { log += d; });
const started = new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('server did not start: ' + log)), 8000);
  server.stdout.on('data', d => { if (String(d).includes('listening')) { clearTimeout(t); res(); } });
  server.on('exit', c => { clearTimeout(t); rej(new Error('server exited ' + c + ': ' + log)); });
});

started.then(run).catch(e => { failed++; console.log('ERROR ' + e.message); }).finally(() => {
  server.removeAllListeners('exit');
  server.kill();
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
});
