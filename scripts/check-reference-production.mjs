import {webkit} from 'playwright';import fs from 'node:fs/promises';
await fs.mkdir('tmp',{recursive:true});const browser=await webkit.launch();const page=await browser.newPage({viewport:{width:402,height:874},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`${process.env.TEST_URL??'http://127.0.0.1:5175/menagerie/'}?trace`,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('#game').dataset.heldSpecies);
const seen=new Set();for(let i=0;i<60&&seen.size<6;i++){seen.add(await page.locator('#game').getAttribute('data-held-species'));await page.reload();await page.waitForFunction(()=>document.querySelector('#game').dataset.heldSpecies);}
const results=[];
for(const target of ['armadillo','ram','skunk']){
 for(let i=0;i<80&&(await page.locator('#game').getAttribute('data-held-species'))!==target;i++){await page.reload();await page.waitForFunction(()=>document.querySelector('#game').dataset.heldSpecies);}
 if((await page.locator('#game').getAttribute('data-held-species'))!==target)throw Error(`Missing ${target}`);
 const g=await page.locator('#rotation-guide').boundingBox();const x=g.x+g.width/2,y=g.y+g.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+45,y+20,{steps:8});await page.waitForTimeout(100);await page.mouse.up();await page.locator("#drop").click();
 await page.waitForFunction(()=>document.querySelector('#score').classList.contains('lost')||document.querySelector('#game').dataset.heldSpecies,{},{timeout:11000});await page.waitForTimeout(10000);
 await page.evaluate(()=>dispatchEvent(new Event('pagehide')));const trace=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('menagerie-flight-recorder-v1')));
 const lost=await page.locator('#score').evaluate(e=>e.classList.contains('lost'));const score=await page.locator('#score').textContent();
 const anomalies=trace.events.filter(e=>e.type==='upward_anomaly');if(lost)await page.locator('#drop').click();else await page.reload();await page.waitForFunction(()=>document.querySelector('#game').dataset.heldSpecies);results.push({target,score,lost,anomalies,reset:await page.locator('#score').textContent()});
}
const result={seen:[...seen],results,errors};await browser.close();await fs.writeFile('tmp/reference-production.json',JSON.stringify(result,null,2));console.log(result);
if(seen.size!==6||errors.length||results.some(r=>r.anomalies.length||r.reset!=='0'))process.exitCode=1;
