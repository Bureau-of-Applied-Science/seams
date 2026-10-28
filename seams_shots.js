const {chromium}=require('playwright');
const fs=require('fs');
const body=fs.readFileSync('seams.html','utf8');
const doc='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+body+'</body></html>';
fs.writeFileSync('wrapped.html',doc);
(async()=>{
  const b=await chromium.launch();
  const run=async(name,w,h,hash,fn)=>{
    const p=await b.newPage({viewport:{width:w,height:h}});
    const errs=[];p.on('pageerror',e=>errs.push(String(e)));
    await p.goto('file://'+process.cwd()+'/wrapped.html'+(hash||''));
    await p.waitForTimeout(600);
    if(fn)await fn(p);
    await p.screenshot({path:name});
    const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    console.log(name,'overflow:',ov,'errors:',errs);
    await p.close();
  };
  await run('v4-top-phone.png',390,900,'');
  await run('v4-shared-phone.png',390,900,'#s-l0w050f111y273w5367');
  await run('v4-start-desktop.png',1280,900,'#start-hotel');
  await run('v4-sticky-phone.png',390,700,'',async p=>{await p.evaluate(()=>window.scrollTo(0,document.getElementById('h-report').offsetTop-40));await p.waitForTimeout(400)});
  await run('v4-report-desktop.png',1280,1000,'#start-store',async p=>{await p.evaluate(()=>window.scrollTo(0,document.getElementById('h-report').offsetTop-80));await p.waitForTimeout(400)});
  await run('v4-method-phone.png',390,900,'#start-store',async p=>{await p.evaluate(()=>{const d=document.querySelector('details.method');d.open=true;d.scrollIntoView()});await p.waitForTimeout(300)});
  await b.close();
})();
