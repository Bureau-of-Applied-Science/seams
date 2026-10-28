const fs=require('fs');
const html=fs.readFileSync('seams.html','utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
fs.writeFileSync('page.js',js);
const logic=js.match(/\/\*LOGIC-START\*\/([\s\S]*?)\/\*LOGIC-END\*\//)[1];
const run=new Function(logic+`
const out={problems:[]};
const P=m=>out.problems.push(m);
// unique names
const seen={};ITEMS.forEach(i=>{if(seen[i.name])P('dup name '+i.name);seen[i.name]=1});
const catIds=CATS.map(c=>c.id);
if(new Set(catIds).size!==catIds.length)P('dup cat id');
ITEMS.forEach(i=>{if(catIds.indexOf(i.cat)<0)P('item with unknown cat '+i.name)});
CATS.forEach(c=>{if(!ITEMS.some(i=>i.cat===c.id))P('empty cat '+c.id);if(c.sec<0||c.sec>=SECTIONS.length)P('bad section '+c.id)});
Object.keys(KB).forEach(k=>{const [a,b]=k.split('|');if(catIds.indexOf(a)<0||catIds.indexOf(b)<0||a===b)P('bad KB key '+k);
  const rev=b+'|'+a;if(KB[rev])P('KB both orders '+k)});
Object.keys(SAME).forEach(k=>{if(catIds.indexOf(k)<0)P('bad SAME '+k)});
const humanItems=ITEMS.filter(i=>i.cat==='human').map(i=>i.name);
humanItems.forEach(n=>{if(!HUMAN[n])P('missing HUMAN '+n)});
Object.keys(HUMAN).forEach(n=>{if(humanItems.indexOf(n)<0)P('extra HUMAN '+n)});
const idx=n=>{const it=ITEMS.find(i=>i.name===n);if(!it)throw new Error('no item '+n);return it.idx};
const mk=names=>new Set(names.map(idx));
const dash=[];
[...Object.values(KB),...Object.values(SAME),...Object.values(HUMAN),GLUE,OFFBOARD,EXTRA].forEach(x=>{if(/[\\u2014\\u2013]/.test(x.risk+x.check))dash.push(x.risk)});
if(dash.length)P('em/en dash in copy');
Object.keys(Q).forEach(k=>{if(!KB[k])P('Q key not in KB '+k);else if(!/\{a\}|\{b\}/.test(Q[k])&&k!=='x')0});
Object.keys(SAMEQ).forEach(k=>{if(!SAME[k])P('SAMEQ key '+k)});
Object.keys(SUITE).forEach(n=>{if(!ITEMS.some(i=>i.name===n))P('SUITE name not in registry '+n)});
Object.keys(PRESETS).forEach(id=>{if(!/^[a-z]+$/.test(id))P('bad preset id '+id);PRESETS[id].names.forEach(n=>{if(!ITEMS.some(i=>i.name===n))P('preset '+id+' unknown '+n)})});
PRESET_ORDER.forEach(id=>{if(!PRESETS[id])P('order id '+id)});
Object.keys(PRESETS).forEach(id=>{if(PRESET_ORDER.indexOf(id)<0)P('preset not in order '+id)});
const qs=[...Object.values(Q),...Object.values(SAMEQ),GLUE.q,...Object.values(HUMAN).map(h=>h.q||'')];
if(qs.some(q=>/[\u2014\u2013]/.test(q)))P('dash in quip');
out.counts={items:ITEMS.length,cats:CATS.length,kb:Object.keys(KB).length,same:Object.keys(SAME).length};
const cases={
 sample:[['Stripe','Kajabi','Zendesk','Mailchimp','QuickBooks','Zapier','Google Sheets'],1,0],
 restaurant:[['Toast','QuickBooks','Gusto','Mailchimp','Google Business Profile','Meta Business Suite','Google Workspace','Google Sheets'],1,0],
 hotel:[['Cloudbeds','Booking.com','Expedia','Stripe','QuickBooks','Mailchimp','WordPress','Google Business Profile','Google Workspace'],1,0],
 therapy:[['SimplePractice','Google Workspace','Mailchimp','Zoom','QuickBooks','ChatGPT','Google Calendar','Typeform'],1,0],
 nativeGoogle:[['Google Workspace','Google Calendar','Google Meet','Google Sheets','Google Drive'],1,0],
 nativeShopify:[['Shopify','Shopify POS','Shopify Payments','QuickBooks'],1,0],
 mixedPos:[['Shopify','Shopify POS','Square','QuickBooks'],1,0],
 trades:[['Jobber','QuickBooks','Stripe','Google Calendar','Mailchimp','Google Business Profile','Google Voice'],2,1],
 shopify:[['Shopify','Stripe','Klaviyo','ShipStation','QuickBooks','Zendesk','Zapier','Google Analytics','Meta Ads Manager'],1,0],
 tiny:[['Stripe','QuickBooks'],3,0],
 empty:[[],1,0],
 extraOnly:[[],1,5],
};
out.cases={};
for(const k in cases){
  const [names,o,e]=cases[k];const sel=mk(names);const a=analyze(sel,o,e);
  const h=encodeState(sel,o,e);const d=decodeState('#'+h);
  const same=d&&d.owner===o&&d.extra===e&&d.sel.size===sel.size&&[...sel].every(i=>d.sel.has(i));
  out.cases[k]={n:a.n,possible:a.possible,named:a.seams.length,score:a.score,grade:a.grade,roast:a.roast,top:a.top&&a.top.label,topSev:a.top&&a.top.sev,native:a.nativeN,tags:a.seams.filter(x=>x.native).length,roundtrip:!!same};
}
// presets
out.presets={};
PRESET_ORDER.forEach(id=>{const sel=mk(PRESETS[id].names);const a=analyze(sel,1,0);out.presets[id]={n:a.n,named:a.seams.length,score:a.score,grade:a.grade,roast:a.roast,native:a.nativeN}});
// determinism: order of insertion must not change result
{const names=['Stripe','Square','Kajabi','Zendesk','Toast'];const A=analyze(mk(names),1,0),B=analyze(mk(names.slice().reverse()),1,0);
 if(JSON.stringify(A)!==JSON.stringify(B))P('analyze depends on insertion order');}
const all=new Set(ITEMS.map(i=>i.idx));
const a=analyze(all,0,31);
const h=encodeState(all,0,31),d=decodeState('#'+h);
out.all={score:a.score,named:a.seams.length,hashLen:h.length,roundtrip:d.sel.size===all.size&&d.extra===31&&d.owner===0};
return out;`);
console.log(JSON.stringify(run(),null,1));
