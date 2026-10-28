// Server-side share card. Mirrors drawCard in seams.html (1200x630) using satori + resvg.
const fs = require('fs');
const path = require('path');
const satori = require('satori').default || require('satori');
const { Resvg } = require('@resvg/resvg-js');

const SITE_LABEL = 'bureauofapplied.science';
const C = { bg: '#1c1a17', line: '#3b362e', cream: '#efe6d2', dim: '#a79e8b', amber: '#ffb43a', alert: '#ff7b5a' };

const font = (file, name, weight) => ({ name, weight, style: 'normal', data: fs.readFileSync(path.join(__dirname, 'fonts', file)) });
const FONTS = [
  font('libre-franklin-latin-400-normal.woff', 'Libre Franklin', 400),
  font('libre-franklin-latin-800-normal.woff', 'Libre Franklin', 800),
  font('libre-franklin-latin-900-normal.woff', 'Libre Franklin', 900),
  font('ibm-plex-mono-latin-500-normal.woff', 'IBM Plex Mono', 500),
  font('ibm-plex-mono-latin-600-normal.woff', 'IBM Plex Mono', 600)
];

const D = 'Libre Franklin', M = 'IBM Plex Mono';
// Absolutely positioned text box. top is the CSS box top for lineHeight 1, so callers pass a baseline minus an ascent offset.
function t(text, o) {
  return {
    type: 'div',
    props: {
      style: Object.assign({ display: 'flex', position: 'absolute', lineHeight: 1, whiteSpace: 'nowrap' }, o),
      children: text
    }
  };
}
function box(o) { return { type: 'div', props: { style: Object.assign({ display: 'flex', position: 'absolute' }, o), children: [] } }; }

function frame(children) {
  return {
    type: 'div',
    props: {
      style: { display: 'flex', position: 'relative', width: 1200, height: 630, background: C.bg },
      children: [
        box({ left: 20, top: 20, width: 1160, height: 590, border: '2px solid ' + C.line }),
        t('BUREAU OF APPLIED SCIENCE', { left: 64, top: 59, fontFamily: M, fontWeight: 600, fontSize: 20, letterSpacing: 3, color: C.amber }),
        t('FORM 7-S / SEAM ASSESSMENT', { right: 64, top: 59, fontFamily: M, fontWeight: 600, fontSize: 20, letterSpacing: 3, color: C.dim }),
        box({ left: 64, top: 96, width: 1072, height: 2, background: C.line })
      ].concat(children, [
        t(SITE_LABEL, { left: 64, top: 581, fontFamily: M, fontWeight: 500, fontSize: 18, letterSpacing: 2, color: C.amber }),
        t('COUNT YOURS', { right: 64, top: 581, fontFamily: M, fontWeight: 500, fontSize: 18, letterSpacing: 2, color: C.dim })
      ])
    }
  };
}

// Greedy wrap by estimated glyph width, since satori has no measureText.
function wrap(text, maxChars, maxLines) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  words.forEach(w => {
    const next = line ? line + ' ' + w : w;
    if (next.length > maxChars && line) { lines.push(line); line = w; } else line = next;
  });
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function scoreCard(a) {
  const word = a.n ? a.grade : 'NO DATA';
  const size = Math.max(28, Math.min(68, Math.floor(476 / (word.length * 0.66))));
  const on = Math.round(a.score / 5), segW = (536 - 19 * 4) / 20;
  const meter = [];
  for (let i = 0; i < 20; i++) meter.push(box({ left: 64 + i * (segW + 4), top: 432, width: segW, height: 18, background: i < on ? (i >= 15 ? C.alert : C.amber) : C.line }));
  const sub = wrap(a.n ? a.gradeSub : 'Tap a few tools to get your read.', 34, 2);
  const roast = wrap(a.n ? a.roast : '', 50, 2);
  return frame([
    t('SEAM LOAD', { left: 64, top: 130, fontFamily: M, fontWeight: 500, fontSize: 20, letterSpacing: 3, color: C.dim }),
    t(String(a.score), { left: 56, top: 168, fontFamily: D, fontWeight: 900, fontSize: 236, letterSpacing: -8, color: C.amber }),
    t('OUT OF 100', { left: 64, top: 392, fontFamily: M, fontWeight: 500, fontSize: 20, letterSpacing: 3, color: C.dim })
  ].concat(meter, [
    t('GRADE', { left: 660, top: 130, fontFamily: M, fontWeight: 500, fontSize: 20, letterSpacing: 3, color: C.dim }),
    t(word, { left: 660, top: 226 - size * 0.8, fontFamily: D, fontWeight: 900, fontSize: size, letterSpacing: -1, color: C.cream })
  ], sub.map((l, i) => t(l, { left: 660, top: 276 - 21 + i * 34, fontFamily: D, fontWeight: 400, fontSize: 26, color: C.dim })), [
    t(a.n + (a.n === 1 ? ' item' : ' items') + ' counted', { left: 660, top: 372, fontFamily: M, fontWeight: 500, fontSize: 26, color: C.cream }),
    t(a.possible + ' possible seams', { left: 660, top: 410, fontFamily: M, fontWeight: 500, fontSize: 26, color: C.cream }),
    t(a.seams.length + ' named failure points', { left: 660, top: 448, fontFamily: M, fontWeight: 500, fontSize: 26, color: C.cream })
  ], roast.map((l, i) => t(l, { left: 64, top: 520 - 30 + i * 46, fontFamily: D, fontWeight: 800, fontSize: 38, letterSpacing: -1, color: C.cream }))));
}

function defaultCard() {
  const lines = wrap('Software rarely fails inside a tool. It fails in the gap between two of them.', 40, 3);
  return frame([
    t('SEAMS', { left: 56, top: 150, fontFamily: D, fontWeight: 900, fontSize: 210, letterSpacing: -9, color: C.cream }),
    box({ left: 838, top: 292, width: 28, height: 28, background: C.amber }),
    t('SEAM LOAD / 0 TO 100', { left: 64, top: 392, fontFamily: M, fontWeight: 500, fontSize: 20, letterSpacing: 3, color: C.dim })
  ].concat(lines.map((l, i) => t(l, { left: 64, top: 440 + i * 44, fontFamily: D, fontWeight: 800, fontSize: 36, letterSpacing: -1, color: C.cream }))));
}

async function png(tree) {
  const svg = await satori(tree, { width: 1200, height: 630, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

module.exports = { renderScore: a => png(scoreCard(a)), renderDefault: () => png(defaultCard()) };
