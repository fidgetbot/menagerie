import {webkit} from 'playwright';import fs from 'node:fs/promises';
await fs.mkdir('tmp',{recursive:true});const browser=await webkit.launch();const page=await browser.newPage({viewport:{width:402,height:874},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`${process.env.TEST_URL??'http://127.0.0.1:5175/menagerie/'}?trace`,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#game').dataset.heldSpecies);
const seen=new Set();for(let i=0;i<60&&seen.size<7;i++){seen.add(await page.locator('#game').getAttribute('data-held-species'));await page.locator('#restart').click();}
const results=[];
for(const target of ['armadillo','dragonfly','ram','skunk']){
 for(let i=0;i<80&&(await page.locator('#game').getAttribute('data-held-species'))!==target;i++)await page.locator('#restart').click();
 if((await page.locator('#game').getAttribute('data-held-species'))!==target)throw Error(`Missing ${target}`);
 await page.mouse.move(200,600);await page.mouse.down();await page.mouse.move(245,620,{steps:8});await page.waitForTimeout(100);await page.mouse.up();
 await page.waitForFunction(()=>!document.querySelector('#game-over').classList.contains('hidden')||document.querySelector('#game').dataset.heldSpecies,{},{timeout:11000});await page.waitForTimeout(10000);
 await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const trace=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('menagerie-flight-recorder-v1')));
 const lost=await page.locator('#game-over').evaluate(e=>!e.classList.contains('hidden'));const score=await page.locator('#score').textContent();
 const anomalies=trace.events.filter(e=>e.type==='upward_anomaly');await page.locator(lost?'#play-again':'#restart').click();results.push({target,score,lost,anomalies,reset:await page.locator('#score').textContent()});
}
const result={seen:[...seen],results,errors};await browser.close();await fs.writeFile('tmp/reference-production.json',JSON.stringify(result,null,2));console.log(result);
if(seen.size!==7||errors.length||results.some(r=>r.anomalies.length||r.reset!=='0'))process.exitCode=1;
