import { webkit } from 'playwright';
import fs from 'node:fs/promises';
const output=new URL(process.env.TEST_OUTPUT ?? '../tmp/expansion-test/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const browser=await webkit.launch({headless:true});
const species=['tortoise','capybara','toucan','armadillo','ram','skunk'];
const jobs=species.flatMap(a=>species.map(b=>({a,b,rx:0})));
for(const a of species.slice(3))for(const rx of [30,90,180])jobs.push({a,b:a,rx});
if(process.env.TEST_CROSS_AXIS){
 jobs.length=0;
 for(const a of species.slice(3))for(const degrees of [30,90]){
  const half=degrees*Math.PI/360;
  jobs.push({a,b:a,rx:degrees,axis:'y',rotation:[0,Math.sin(half),0,Math.cos(half)]});
 }
}
if(process.env.TEST_SPECIES){for(let i=jobs.length-1;i>=0;i--)if(jobs[i].a!==process.env.TEST_SPECIES&&jobs[i].b!==process.env.TEST_SPECIES)jobs.splice(i,1);}
if(process.env.TEST_PAIR){const [a,b]=process.env.TEST_PAIR.split(',');for(let i=jobs.length-1;i>=0;i--)if(jobs[i].a!==a||jobs[i].b!==b||jobs[i].rx!==0)jobs.splice(i,1);}
const results=[];
async function worker(){while(jobs.length){const job=jobs.shift();const page=await browser.newPage({viewport:{width:402,height:714},isMobile:true,hasTouch:true}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${process.env.TEST_URL ?? "http://127.0.0.1:5173/menagerie/"}?trace&diagnostics&sequence=${job.a},${job.b}&rx=${job.rx}${job.rotation ? `&rotations=${job.rotation.join(",")}` : ""}`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#game').dataset.heldSpecies);
 if(job.a===job.b&&job.rx===0)await page.screenshot({path:new URL(`new-${job.a}.png`,output).pathname});
 for(let turn=0;turn<(job.rx===0?2:1);turn++){
  await page.mouse.move(200,540);await page.mouse.down();await page.waitForTimeout(40);await page.mouse.up();
  await page.waitForFunction(()=>!document.querySelector('#game-over').classList.contains('hidden')||document.querySelector('#game').dataset.heldSpecies,{},{timeout:11000});
  if(await page.locator('#game-over').evaluate(e=>!e.classList.contains('hidden')))break;
 }
 await page.waitForTimeout(10000);
 await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 const trace=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('menagerie-flight-recorder-v1')));
 const anomalies=trace.events.filter(e=>e.type==='upward_anomaly');
 if(anomalies.length||process.env.TEST_PAIR)await fs.writeFile(new URL(`trace-${job.a}-${job.b}-${job.rx}.json`,output),JSON.stringify(trace));
 const score=await page.locator('#score').textContent();const lost=await page.locator('#game-over').evaluate(e=>!e.classList.contains('hidden'));
 await page.locator(lost?'#play-again':'#restart').click(); await page.waitForTimeout(100);
 results.push({...job,score,lost,anomalies,errors,reset:await page.locator('#score').textContent()});
 console.log(JSON.stringify(results.at(-1)));
}catch(e){results.push({...job,error:String(e),errors});console.log(JSON.stringify(results.at(-1)));}finally{await page.close();}}
}
await Promise.all([worker(),worker(),worker()]);
await fs.writeFile(new URL('results.json',output),JSON.stringify(results,null,2));await browser.close();

if(results.some(r=>r.error||r.errors.length||r.reset!=='0'||r.anomalies?.length)) process.exitCode=1;
