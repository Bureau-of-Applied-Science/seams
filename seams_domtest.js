const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs');
let html=fs.readFileSync('seams.html','utf8').replace(/<link[^>]*>/,'');
const errors=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>errors.push('jsdomError: '+(e.detail&&e.detail.message||e.message)));
vc.on('error',e=>errors.push('console.error: '+e));
const dom=new JSDOM('<!doctype html><html><head></head><body>'+html+'</body></html>',{
  url:'https://example.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
  beforeParse(w){
    const ctx=new Proxy({},{get:(t,k)=>k==='measureText'?(s=>({width:String(s).length*10})):(k in t?t[k]:()=>{}),set:(t,k,v)=>{t[k]=v;return true}});
    w.HTMLCanvasElement.prototype.getContext=()=>ctx;
    w.HTMLCanvasElement.prototype.toBlob=function(cb){cb(null)};
  }
});
const w=dom.window,d=w.document;
const out={};
const txt=id=>d.getElementById(id).textContent;
out.initial={score:txt('score'),grade:txt('grade'),chips:d.querySelectorAll('.chip').length,
  pressed:d.querySelectorAll('.chip[aria-pressed="true"]').length,bands:d.querySelectorAll('.band').length,
  groups:d.querySelectorAll('.group').length,mapped:txt('mapped').slice(0,60),bannerHidden:d.getElementById('banner').hidden,
  seamsShown:d.querySelectorAll('.seam').length,moreBtn:!!d.getElementById('showAll')};
// click a chip: add Toast
const chip=n=>[...d.querySelectorAll('.chip')].find(c=>c.textContent===n);
chip('Toast').click();
out.afterToast={score:txt('score'),pressed:d.querySelectorAll('.chip[aria-pressed="true"]').length,hash:w.location.hash,bannerHidden:d.getElementById('banner').hidden};
// search
const q=d.getElementById('q');q.value='jobb';q.dispatchEvent(new w.Event('input'));
out.search={visibleChips:[...d.querySelectorAll('.chip:not([hidden])')].map(c=>c.textContent),
  industryOpen:d.querySelector('details.band').open,nomatch:d.getElementById('nomatch').hidden};
q.value='zzzz';q.dispatchEvent(new w.Event('input'));
out.noMatch={visible:d.querySelectorAll('.chip:not([hidden])').length,nomatchShown:!d.getElementById('nomatch').hidden};
q.value='';q.dispatchEvent(new w.Event('input'));
out.cleared={visible:d.querySelectorAll('.chip:not([hidden])').length};
// extra tools
d.getElementById('exPlus').click();d.getElementById('exPlus').click();d.getElementById('exPlus').click();
out.extra={val:txt('exVal'),stats:d.getElementById('stats').textContent.replace(/\s+/g,' ').slice(0,80),hash:w.location.hash};
// owner
d.getElementById('owner-0').checked=true;d.getElementById('owner-0').dispatchEvent(new w.Event('change'));
out.owner={score:txt('score'),roast:txt('roast')};
// hash round trip: reload from hash
const hash=w.location.hash;
const dom2=new JSDOM('<!doctype html><html><head></head><body>'+html+'</body></html>',{
  url:'https://example.test/'+hash,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
  beforeParse(w2){
    const ctx=new Proxy({},{get:(t,k)=>k==='measureText'?(s=>({width:String(s).length*10})):(k in t?t[k]:()=>{}),set:(t,k,v)=>{t[k]=v;return true}});
    w2.HTMLCanvasElement.prototype.getContext=()=>ctx;
  }
});
const d2=dom2.window.document;
out.reload={hash,score:d2.getElementById('score').textContent,extra:d2.getElementById('exVal').textContent,
  pressed:d2.querySelectorAll('.chip[aria-pressed="true"]').length,bannerHidden:d2.getElementById('banner').hidden,
  ownerChecked:[...d2.querySelectorAll('#owner input')].findIndex(i=>i.checked)};
// clear -> empty state
d.getElementById('exMinus').click();d.getElementById('exMinus').click();d.getElementById('exMinus').click();
[...d.querySelectorAll('.chip[aria-pressed="true"]')].forEach(c=>c.click());
out.empty={score:txt('score'),grade:txt('grade'),banner:d.getElementById('banner').textContent.replace(/\s+/g,' ').slice(0,60),seams:d.getElementById('seams').textContent.slice(0,60)};
// industry chip opens details
chip('Jobber').click();
out.industry={open:d.querySelector('details.band').open};
// share text
out.share=d.getElementById('shareText').value.slice(0,120);
// presets: button click
const presetBtns=[...d.querySelectorAll('#presetRow button')];
out.presets={count:presetBtns.length,labels:presetBtns.map(b=>b.textContent)};
presetBtns.find(b=>b.textContent==='Online store').click();
out.presetStore={score:txt('score'),pressed:d.querySelectorAll('.chip[aria-pressed="true"]').length,banner:d.getElementById('banner').textContent.replace(/\s+/g,' ').slice(0,90),hash:w.location.hash,roast:txt('roast'),native:d.getElementById('nativeNote').hidden?'':d.getElementById('nativeNote').textContent,tag:d.querySelectorAll('.tag').length};
chip('Klaviyo').click();
out.presetEdited={bannerHidden:d.getElementById('banner').hidden};
// mid cta
out.midCta={hidden:d.getElementById('midCta').hidden,text:d.getElementById('midText').textContent,href:d.getElementById('midLink').href,cta:d.getElementById('ctaLink').href};
// sticky content
out.sticky={score:txt('sScore'),grade:txt('sGrade'),fill:d.getElementById('sFill').style.width};
// shared view: load from hash
const hash3=w.location.hash;
function load(url){const dd=new JSDOM('<!doctype html><html><head></head><body>'+html+'</body></html>',{url,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w3){const c3=new Proxy({},{get:(t,k)=>k==='measureText'?(s=>({width:String(s).length*10})):(k in t?t[k]:()=>{}),set:(t,k,v)=>{t[k]=v;return true}});w3.HTMLCanvasElement.prototype.getContext=()=>c3;w3.HTMLCanvasElement.prototype.toBlob=function(cb){cb(null)};}});return dd.window}
const w3=load('https://example.test/'+hash3),d3=w3.document;
out.sharedView={barHidden:d3.getElementById('shared').hidden,bar:d3.getElementById('shared').textContent.replace(/\s+/g,' ').slice(0,100),eyebrow:d3.getElementById('eyAssess').textContent,midHidden:d3.getElementById('midCta').hidden};
d3.getElementById('shFresh').click();
out.sharedFresh={barHidden:d3.getElementById('shared').hidden,pressed:d3.querySelectorAll('.chip[aria-pressed="true"]').length,score:d3.getElementById('score').textContent,banner:d3.getElementById('banner').textContent.replace(/\s+/g,' ').slice(0,50),hash:w3.location.hash,eyebrow:d3.getElementById('eyAssess').textContent};
const w4=load('https://example.test/'+hash3),d4=w4.document;
d4.getElementById('shEdit').click();
out.sharedEdit={barHidden:d4.getElementById('shared').hidden,pressed:d4.querySelectorAll('.chip[aria-pressed="true"]').length,eyebrow:d4.getElementById('eyAssess').textContent};
// outreach link
const w5=load('https://example.test/#start-restaurant'),d5=w5.document;
out.startLink={pressed:d5.querySelectorAll('.chip[aria-pressed="true"]').length,barHidden:d5.getElementById('shared').hidden,banner:d5.getElementById('banner').textContent.replace(/\s+/g,' ').slice(0,70),hash:w5.location.hash};
const w6=load('https://example.test/#start-nonsense'),d6=w6.document;
out.badStart={score:d6.getElementById('score').textContent,sampleBanner:d6.getElementById('banner').textContent.slice(0,30)};
// seam list with tag
out.errors=errors;
console.log(JSON.stringify(out,null,1));
