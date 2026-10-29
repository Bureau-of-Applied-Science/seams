// Headless DOM test for seams.html. Run from this directory: node seams_domtest.js
// Needs jsdom (npm i jsdom). Exits 1 on any failed assertion or page error.
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('seams.html', 'utf8').replace(/<link[^>]*>/, '');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => {
  const m = (e.detail && e.detail.message) || e.message;
  if (!/Not implemented/.test(m)) errors.push('jsdomError: ' + m);
});
vc.on('error', e => errors.push('console.error: ' + e));

function load(url) {
  return new JSDOM('<!doctype html><html><head></head><body>' + html + '</body></html>', {
    url, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      const ctx = new Proxy({}, {
        get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 10 })) : (k in t ? t[k] : () => {}),
        set: (t, k, v) => { t[k] = v; return true; }
      });
      w.HTMLCanvasElement.prototype.getContext = () => ctx;
      w.HTMLCanvasElement.prototype.toBlob = function (cb) { cb(null); };
    }
  }).window;
}

let failed = 0, passed = 0;
function eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else { failed++; console.log('FAIL ' + name + '\n  got:  ' + JSON.stringify(got) + '\n  want: ' + JSON.stringify(want)); }
}
function ok(name, cond, detail) { eq(name, !!cond, true); if (!cond && detail) console.log('  ' + detail); }

function view(w) {
  const d = w.document, g = id => d.getElementById(id);
  return {
    score: g('score').textContent,
    grade: g('grade').textContent,
    pressed: d.querySelectorAll('.chip[aria-pressed="true"]').length,
    extra: g('exVal').textContent,
    owner: [...d.querySelectorAll('#owner input')].findIndex(i => i.checked),
    banner: g('banner').hidden ? '' : g('banner').textContent.replace(/\s+/g, ' ').trim(),
    shared: !g('shared').hidden,
    roast: g('roast').textContent,
    url: w.location.pathname + w.location.search + w.location.hash
  };
}
const chip = (d, n) => [...d.querySelectorAll('.chip')].find(c => c.textContent === n);
const EMPTY_BANNER = 'Nothing selected yet. Tap your tools below.Load sample';

// ---- bare load: empty, not the sample
let w = load('https://example.test/'), d = w.document;
let v = view(w);
eq('bare load score', v.score, '0');
eq('bare load grade', v.grade, 'NO DATA');
eq('bare load pressed', v.pressed, 0);
eq('bare load banner', v.banner, EMPTY_BANNER);
eq('bare load url untouched', v.url, '/');
eq('bare load roast', v.roast, 'Tap a few tools to get your read.');
eq('chip count', d.querySelectorAll('.chip').length, 291);
eq('preset buttons', [...d.querySelectorAll('#presetRow button')].length, 8);
ok('mapped line', /^291 tools mapped across 33 categories/.test(d.getElementById('mapped').textContent));
eq('no seams listed', d.querySelectorAll('.seam').length, 0);

// ---- sample
d.getElementById('bSample').click();
v = view(w);
eq('sample score', v.score, '57');
eq('sample pressed', v.pressed, 7);
ok('sample banner', /^Sample stack loaded/.test(v.banner));
eq('sample does not write url', v.url, '/');
d.getElementById('bClear').click();
v = view(w);
eq('clear score', v.score, '0');
eq('clear banner', v.banner.startsWith('Nothing selected yet'), true);

// ---- tapping writes ?r= and never a hash
w = load('https://example.test/'); d = w.document;
chip(d, 'Toast').click();
v = view(w);
eq('toast pressed', v.pressed, 1);
ok('url uses ?r=', /^\/\?r=s-[lb][0-9a-z]+$/.test(v.url), v.url);
eq('banner hidden once tapping', v.banner, '');

// ---- search
const q = d.getElementById('q');
q.value = 'jobb'; q.dispatchEvent(new w.Event('input'));
eq('search finds Jobber', [...d.querySelectorAll('.chip:not([hidden])')].map(c => c.textContent), ['Jobber']);
eq('search opens industry band', d.querySelector('details.band').open, true);
q.value = 'zzzz'; q.dispatchEvent(new w.Event('input'));
eq('no match hides all', d.querySelectorAll('.chip:not([hidden])').length, 0);
eq('no match message', d.getElementById('nomatch').hidden, false);
q.value = ''; q.dispatchEvent(new w.Event('input'));
eq('clearing search restores chips', d.querySelectorAll('.chip:not([hidden])').length, 291);

// ---- build a stack: tools, other-tools stepper, owner
['Stripe', 'Kajabi', 'Zendesk'].forEach(n => chip(d, n).click());
d.getElementById('exPlus').click(); d.getElementById('exPlus').click(); d.getElementById('exPlus').click();
eq('stepper value', d.getElementById('exVal').textContent, '3');
const o0 = d.getElementById('owner-0'); o0.checked = true; o0.dispatchEvent(new w.Event('change'));
const built = view(w);
eq('built owner', built.owner, 0);
eq('built pressed', built.pressed, 4);
eq('built extra', built.extra, '3');
ok('built scored', Number(built.score) > 0);
ok('built url', /^\/\?r=s-/.test(built.url), built.url);

// ---- reload from ?r= reproduces the stack and shows the shared bar
const fromQuery = view(load('https://example.test' + built.url));
eq('?r= reload same score', fromQuery.score, built.score);
eq('?r= reload same chips', fromQuery.pressed, built.pressed);
eq('?r= reload same extra', fromQuery.extra, built.extra);
eq('?r= reload same owner', fromQuery.owner, built.owner);
eq('?r= reload shows shared bar', fromQuery.shared, true);

// ---- legacy #s- hash decodes to the same stack
const state = built.url.split('?r=')[1];
const fromHash = view(load('https://example.test/#' + state));
eq('legacy hash same score', fromHash.score, built.score);
eq('legacy hash same chips', fromHash.pressed, built.pressed);
eq('legacy hash shows shared bar', fromHash.shared, true);

// ---- precedence and bad input
eq('?r= wins over hash', view(load('https://example.test/?r=' + state + '#start-hotel')).score, built.score);
eq('bad ?r= falls back to empty', view(load('https://example.test/?r=garbage')).banner, EMPTY_BANNER);
eq('bad ?r= falls back to hash', view(load('https://example.test/?r=garbage#' + state)).score, built.score);

// ---- clear back to empty
d.getElementById('exMinus').click(); d.getElementById('exMinus').click(); d.getElementById('exMinus').click();
[...d.querySelectorAll('.chip[aria-pressed="true"]')].forEach(c => c.click());
v = view(w);
eq('empty after unselect score', v.score, '0');
eq('empty after unselect grade', v.grade, 'NO DATA');
ok('empty list message', /Tap at least two tools/.test(d.getElementById('seams').textContent));

// ---- industry chip opens its band
chip(d, 'Jobber').click();
eq('industry chip opens band', d.querySelector('details.band').open, true);

// ---- presets
const presetBtns = [...d.querySelectorAll('#presetRow button')];
eq('preset labels', presetBtns.map(b => b.textContent),
  ['Restaurant', 'Salon or spa', 'Trades', 'Therapy practice', 'Hotel or B&B', 'Online store', 'Course creator', 'Consultancy']);
presetBtns.find(b => b.textContent === 'Online store').click();
v = view(w);
eq('store preset chips', v.pressed, 8);
ok('store preset banner', /^Typical online store stack loaded/.test(v.banner));
ok('store preset has a score', Number(v.score) > 0);
chip(d, 'Klaviyo').click();
eq('editing a preset hides its banner', view(w).banner, '');

// ---- mid CTA, final CTA and sticky bar
eq('mid cta shown', d.getElementById('midCta').hidden, false);
ok('mid cta names top seam', /^Your top seam is /.test(d.getElementById('midText').textContent));
ok('mid cta utm', /utm_source=seams&utm_medium=assessment&utm_campaign=[a-z]+(&|$)/.test(d.getElementById('midLink').href), d.getElementById('midLink').href);
ok('cta utm', /utm_campaign=[a-z]+(&|$)/.test(d.getElementById('ctaLink').href));
eq('sticky score matches', d.getElementById('sScore').textContent, view(w).score);
ok('share text has score', d.getElementById('shareText').value.startsWith('I scored ' + view(w).score + '/100'));

// ---- shared view actions
const stackUrl = 'https://example.test' + w.location.pathname + w.location.search;
let ws = load(stackUrl), ds = ws.document;
eq('shared bar present', view(ws).shared, true);
eq('shared eyebrow', ds.getElementById('eyAssess').textContent, 'Their assessment');
eq('shared hides mid cta', ds.getElementById('midCta').hidden, true);
ds.getElementById('shFresh').click();
v = view(ws);
eq('count yours empties', [v.pressed, v.shared, v.url], [0, false, '/']);
eq('count yours eyebrow', ds.getElementById('eyAssess').textContent, 'Assessment');
ws = load(stackUrl); ds = ws.document;
ds.getElementById('shEdit').click();
v = view(ws);
eq('edit keeps stack, hides bar', [v.pressed > 0, v.shared], [true, false]);

// ---- outreach links, both forms
for (const [label, url] of [['?start=', 'https://example.test/?start=restaurant'], ['#start-', 'https://example.test/#start-restaurant']]) {
  v = view(load(url));
  eq(label + ' restaurant chips', v.pressed, 7);
  eq(label + ' no shared bar', v.shared, false);
  ok(label + ' banner', /^Typical restaurant stack loaded/.test(v.banner), v.banner);
  eq(label + ' url untouched', v.url, url.replace('https://example.test', ''));
}
eq('?start=nonsense is empty', view(load('https://example.test/?start=nonsense')).banner, EMPTY_BANNER);
eq('#start-nonsense is empty', view(load('https://example.test/#start-nonsense')).banner, EMPTY_BANNER);
eq('?start= beats ?r=', view(load('https://example.test/?start=hotel&r=' + state)).pressed, 8);

// ---- CTAs hand the result to the BAS contact form, with an email fallback
const CONTACT = 'https://bureauofapplied.science/contact';
function cta(win) {
  const dd = win.document;
  const c = new URL(dd.getElementById('ctaLink').href), m = new URL(dd.getElementById('mailLink').href);
  return { c, m, mid: new URL(dd.getElementById('midLink').href), s: c.searchParams.get('s'), body: m.searchParams.get('body'), subject: m.searchParams.get('subject') };
}
ok('cta labels', /Request a seam audit/.test(d.getElementById('ctaLink').textContent) && /Nothing is sent until you press Send/.test(d.querySelector('.ctanote').textContent));
ok('footer says when the result leaves the page', /only when you click that button/.test(d.querySelector('footer').textContent));
let t = cta(w);
eq('cta targets the contact form', [t.c.origin + t.c.pathname, t.c.searchParams.get('from')], [CONTACT, 'seams']);
ok('cta keeps utm', /^[a-z]+$/.test(t.c.searchParams.get('utm_campaign') || '') && t.c.searchParams.get('utm_source') === 'seams');
ok('mid cta matches cta', t.mid.href === t.c.href);
ok('own stack summary: score and grade', t.s && t.s.startsWith('I ran my stack through SEAMS: ' + view(w).score + '/100, '), t.s);
ok('own stack summary: tools', /\nTools: .*Shopify/.test(t.s), t.s);
ok('own stack summary: who finds out', /\nWho finds out first when a seam breaks: whoever happens to notice\./.test(t.s), t.s);
ok('own stack summary: result link round-trips', /\nResult: https:\/\/example\.test\/\?r=s-[lb][0-9a-z]+$/.test(t.s), t.s);
eq('summary link decodes to this stack', view(load(t.s.split('Result: ')[1])).pressed, view(w).pressed);
eq('mailto goes to the inbox', t.m.protocol + t.m.pathname, 'mailto:j@jas.run');
ok('mailto subject names the score', t.subject.startsWith('Seam audit: ' + view(w).score + '/100'), t.subject);
ok('mailto body is the summary', t.body.startsWith('I ran my stack through SEAMS') && /Result: https:/.test(t.body), t.body);

// no summary unless it is the visitor's own stack
const plain = x => ({ s: x.s, body: x.body, from: x.c.searchParams.get('from') });
let w7 = load('https://example.test/'), d7 = w7.document;
eq('empty stack: clean form link', plain(cta(w7)), { s: null, body: 'I would like to talk about my stack.', from: 'seams' });
d7.getElementById('bSample').click();
eq('sample stack: clean form link', plain(cta(w7)).s, null);
eq('shared link: clean form link', plain(cta(load('https://example.test/?r=' + state))).s, null);
eq('shared link keeps from=seams', plain(cta(load('https://example.test/?r=' + state))).from, 'seams');
d7.getElementById('shFresh') && d7.getElementById('shFresh').click();

// the largest stack still fits the caps and keeps the result link whole
w7 = load('https://example.test/'); d7 = w7.document;
[...d7.querySelectorAll('.chip')].forEach(c => c.click());
t = cta(w7);
ok('max stack: 291 chips', view(w7).pressed === 291);
ok('max stack: s within cap', t.s.length <= 1400, 'length ' + t.s.length);
ok('max stack: link intact at the end', /Result: https:\/\/example\.test\/\?r=s-[lb][0-9a-z]+$/.test(t.s));
ok('max stack: tools truncated with a count', /Tools: .*, and \d+ more\./.test(t.s));
ok('max stack: mailto body within cap', t.body.length <= 900 + 2, 'length ' + t.body.length);
ok('max stack: url stays under 8000 chars', t.c.href.length < 8000, 'length ' + t.c.href.length);

eq('page errors', errors, []);
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
