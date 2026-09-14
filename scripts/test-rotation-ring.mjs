import { webkit } from 'playwright';
import { Quaternion, Vector3 } from 'three';
import fs from 'node:fs/promises';
await fs.mkdir('tmp', {recursive:true});
const browser = await webkit.launch();
const assert = (v,m) => { if(!v) throw Error(m); };
const distance = (a,b) => Math.min(Math.hypot(...a.map((v,i)=>v-b[i])),Math.hypot(...a.map((v,i)=>v+b[i])));
for (const mobile of [true,false]) {
 const p=await browser.newPage({viewport:mobile?{width:390,height:714}:{width:1000,height:800},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`${process.env.TEST_URL??'http://127.0.0.1:5175/menagerie/'}?trace`);
 await p.waitForSelector('#rotation-guide:not([hidden])');await p.waitForTimeout(1500);
 const trace=()=>p.evaluate(()=>{dispatchEvent(new Event('pagehide'));return JSON.parse(sessionStorage.getItem('menagerie-flight-recorder-v1'));});
 const q=async()=>{await p.waitForTimeout(75);return (await trace()).samples.at(-1).held.q;};
 const geometry=()=>p.locator('#rotation-guide').evaluate(e=>{const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,r:Number(e.dataset.radius)};});
 let c=await geometry();
 await p.mouse.move(c.x+c.r,c.y);await p.mouse.down();const before=await q();c=await geometry();
 assert(await p.locator('#rotation-guide').getAttribute('data-mode')==='twist','Rim not selected');
 for(let i=1;i<=12;i++){const a=i*Math.PI/24;await p.mouse.move(c.x+c.r*Math.cos(a),c.y+c.r*Math.sin(a));}
 const after=await q();const delta=new Quaternion(...after).multiply(new Quaternion(...before).invert());
 const axis=new Vector3(delta.x,delta.y,delta.z).normalize();const view=new Vector3(6.9,-12.35,6).normalize();
 assert(Math.abs(axis.dot(view))>.999,'Twist tipped the animal');
 assert(Math.abs(2*Math.acos(Math.abs(delta.w))-Math.PI/2)<.012,`Twist not 1:1: ${2*Math.acos(Math.abs(delta.w))}`);
 assert(JSON.stringify(c)===JSON.stringify(await geometry()),'Guide moved during drag');
 await p.mouse.move(c.x+30,c.y+30);assert(await p.locator('#rotation-guide').getAttribute('data-mode')==='twist','Crossing rim changed mode');
 await p.waitForTimeout(120);await p.mouse.up();
 c=await geometry();await p.mouse.move(c.x,c.y);await p.mouse.down();const tumbleStart=await q();
 await p.mouse.move(c.x+c.r*.4,c.y-c.r*.25,{steps:5});assert(distance(tumbleStart,await q())>.05,'No tumble');
 await p.mouse.move(c.x,c.y,{steps:5});assert(distance(tumbleStart,await q())<.001,'Returning did not undo tumble');
 await p.mouse.move(c.x+c.r+15,c.y);assert(await p.locator('#rotation-guide').getAttribute('data-mode')==='tumble','Tumble switched to twist');
 await p.waitForTimeout(120);await p.mouse.up();assert(!(await trace()).events.some(e=>e.type==='released'),'Lift dropped');
 c=await geometry();await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(c.x+35,c.y+20,{steps:2});await p.mouse.up();const flick=await q();await p.waitForTimeout(150);assert(distance(flick,await q())>.001,'No gentle flick');
 if(mobile)await p.touchscreen.tap(c.x,c.y);else {await p.mouse.down();await p.mouse.up();}
 const caught=await q();await p.waitForTimeout(150);assert(distance(caught,await q())<.001,'Catch failed');
 c=await geometry();await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(c.x+20,c.y+10);await p.evaluate(()=>dispatchEvent(new Event('blur')));await p.mouse.up();const cancelled=await q();await p.waitForTimeout(150);assert(distance(cancelled,await q())<.001,'Cancellation kept rotating');assert(!await p.locator('#rotation-guide').getAttribute('data-mode'),'Cancellation left guide active');
 await p.screenshot({path:`tmp/ring-${mobile?'phone':'desktop'}.png`});
 await p.locator('#drop').click();assert(await p.locator('#rotation-guide').isHidden(),'Ring survives drop');
 const t=await trace();assert(distance(t.events.filter(e=>e.type==='drop_requested').at(-1).rotation,t.events.filter(e=>e.type==='released').at(-1).rotation)<.0001,'Drop changed orientation');
 assert(!errors.length,errors.join(','));await p.close();console.log(`${mobile?'Phone':'Desktop'}: direct roll, tumble, undo, mode lock, stable guide, flick, catch and Drop passed`);
}
await browser.close();
