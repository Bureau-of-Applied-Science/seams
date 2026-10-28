// Builds deploy artifacts from ../seams.html (the source of truth):
//   page.html   full document with an <!--OG--> slot the server fills per request
//   logic.js    the DOM-free LOGIC block as a CommonJS module for the OG renderer
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'seams.html'), 'utf8');

const style = /<style>[\s\S]*?<\/style>/.exec(src)[0];
const rest = src.slice(src.indexOf('</style>') + '</style>'.length);

const faces = [];
[400, 600, 700, 800, 900].forEach(w => faces.push(['Libre Franklin', w, 'libre-franklin-latin-' + w + '-normal']));
[400, 500, 600].forEach(w => faces.push(['IBM Plex Mono', w, 'ibm-plex-mono-latin-' + w + '-normal']));
const fontCss = faces.map(f =>
  "@font-face{font-family:'" + f[0] + "';font-style:normal;font-weight:" + f[1] +
  ";font-display:swap;src:url(/fonts/" + f[2] + ".woff2) format('woff2')}"
).join('\n');
const base = '<style>\n' + fontCss + '\n[hidden]{display:none!important}\n</style>';

const favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%231c1a17'/%3E%3Crect x='20' y='20' width='6' height='6' fill='%23ffb43a'/%3E%3C/svg%3E";

const page =
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  '<meta name="color-scheme" content="dark">\n<meta name="theme-color" content="#1c1a17">\n' +
  '<title><!--TITLE--></title>\n<!--OG-->\n' +
  '<link rel="icon" href="' + favicon + '">\n' +
  '<link rel="preload" href="/fonts/libre-franklin-latin-900-normal.woff2" as="font" type="font/woff2" crossorigin>\n' +
  base + '\n' + style + '\n</head>\n<body>' + rest.replace(/^\s*\n/, '\n') + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(__dirname, 'page.html'), page);

const logic = /\/\*LOGIC-START\*\/([\s\S]*?)\/\*LOGIC-END\*\//.exec(src)[1];
fs.writeFileSync(path.join(__dirname, 'logic.js'),
  logic + '\nmodule.exports={analyze:analyze,decodeState:decodeState,encodeState:encodeState,ITEMS:ITEMS,PRESETS:PRESETS};\n');
console.log('built page.html (' + page.length + ' bytes) and logic.js');
