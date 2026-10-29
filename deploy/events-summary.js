// Counts events from the first-party log. Usage: node events-summary.js [path-to-events.ndjson]
const fs = require('fs');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, 'data', 'events.ndjson');
const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
const rows = lines.map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
const tally = key => rows.reduce((o, r) => { const k = key(r); o[k] = (o[k] || 0) + 1; return o; }, {});
const print = (title, o) => {
  console.log('\n' + title);
  Object.keys(o).sort().forEach(k => console.log('  ' + k.padEnd(26) + o[k]));
};
console.log(rows.length + ' events' + (rows.length ? ', ' + rows[0].t + ' to ' + rows[rows.length - 1].t : ''));
print('By event', tally(r => r.e));
print('By event and grade', tally(r => r.e + (r.g ? ' / ' + r.g : '')));
print('Presets', rows.filter(r => r.e === 'preset').reduce((o, r) => { o[r.p] = (o[r.p] || 0) + 1; return o; }, {}));
print('By day', tally(r => r.t.slice(0, 10)));
