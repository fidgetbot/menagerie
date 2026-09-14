import {webkit} from 'playwright';
import fs from 'node:fs/promises';
await fs.mkdir("tmp",{recursive:true});const browser=await webkit.launch();const results=[];
for(const species of ['armadillo','ram','skunk']){
 const page=await browser.newPage({viewport:{width:402,height:874},deviceScaleFactor:2,isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const start=Date.now();await page.goto(`${process.env.TEST_URL ?? "http://127.0.0.1:5173/menagerie/"}?diagnostics&sequence=${species}&rx=0`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#game').dataset.heldSpecies);await page.waitForTimeout(400);
 const readyMs=Date.now()-start;await page.screenshot({path:`tmp/reference-${species}-browser.png`});
 const perf=await page.evaluate(()=>new Promise(resolve=>{const times=[];let last=performance.now();function frame(now){times.push(now-last);last=now;if(times.length<120)requestAnimationFrame(frame);else{times.sort((a,b)=>a-b);resolve({medianFrameMs:times[60],p95FrameMs:times[114]});}}requestAnimationFrame(frame);}));
 results.push({species,readyMs,...perf,errors});await page.close();
}
await browser.close();await fs.writeFile('tmp/reference-browser-metrics.json',JSON.stringify(results,null,2));console.log(results);
