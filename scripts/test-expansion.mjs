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
async function worker(){while(jobs.length){const job=jobs.shift();const page=await browser.newPage({viewport:{width:402,height:714},isMobile:true,hasTouch:true,reducedMotion:'reduce'}); const errors=[];page.on('pageerror',e=>errors.push(e.stack??e.message));
try{
 await page.goto(`${process.env.TEST_URL ?? "http://127.0.0.1:5173/menagerie/"}?audio=0&trace&diagnostics&sequence=${job.a},${job.b}&rx=${job.rx}${job.rotation ? `&rotations=${job.rotation.join(",")}` : ""}`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#game').dataset.heldSpecies);
 if(job.a===job.b&&job.rx===0)await page.screenshot({path:new URL(`new-${job.a}.png`,output).pathname});
 for(let turn=0;turn<(job.rx===0?2:1);turn++){
  const beforeScore=Number(await page.locator('#score').textContent());
  const bubble=await page.locator('#rotation-bubble').evaluate(e=>({x:Number(e.dataset.centerX),y:Number(e.dataset.centerY)}));await page.mouse.click(bubble.x,bubble.y);
  await page.waitForFunction(score=>document.querySelector('#score').classList.contains('lost')||Number(document.querySelector('#score').textContent)>score,beforeScore,{timeout:11000});
  if(await page.locator('#score').evaluate(e=>e.classList.contains('lost')))break;
  if(turn===0){
   const crownError=await page.evaluate(()=>{
    const game=document.querySelector('#game');const held=game.dataset.heldPosition?.split(',').map(Number);const crown=game.dataset.crownPosition?.split(',').map(Number);
    if(!held||!crown)return 'missing held/crown diagnostics';
    const origin=[0,-0.25];const dx=crown[0]-origin[0];const dy=crown[1]-origin[1];const distance=Math.hypot(dx,dy);const scale=distance>0.65?0.65/distance:1;
    const expected=[origin[0]+dx*scale,origin[1]+dy*scale];
    return Math.hypot(held[0]-expected[0],held[1]-expected[1])<0.002?null:`expected ${expected.join(',')} got ${held.slice(0,2).join(',')}`;
   });
   if(crownError)errors.push(`Crown follow: ${crownError}`);
  }
 }
 await page.waitForTimeout(10000);
 await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 const trace=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('menagerie-flight-recorder-v1')));
 const anomalies=trace.events.filter(e=>e.type==='upward_anomaly');
 const settlingGrips=trace.events.filter(e=>e.type==='settling_grip').length;
 if(anomalies.length||process.env.TEST_PAIR)await fs.writeFile(new URL(`trace-${job.a}-${job.b}-${job.rx}.json`,output),JSON.stringify(trace));
 const score=await page.locator('#score').textContent();const lost=await page.locator('#score').evaluate(e=>e.classList.contains('lost'));
 if(lost)await page.locator('#drop').click();else await page.reload();await page.waitForFunction(()=>document.querySelector('#game').dataset.heldSpecies); await page.waitForTimeout(100);
 results.push({...job,score,lost,settlingGrips,anomalies,errors,reset:await page.locator('#score').textContent()});
 console.log(JSON.stringify(results.at(-1)));
}catch(e){results.push({...job,error:String(e),errors});console.log(JSON.stringify(results.at(-1)));}finally{await page.close();}}
}
await Promise.all([worker(),worker(),worker()]);
await fs.writeFile(new URL('results.json',output),JSON.stringify(results,null,2));await browser.close();

if(results.some(r=>r.error||r.errors.length||r.reset!=='0'||r.anomalies?.length)) process.exitCode=1;
