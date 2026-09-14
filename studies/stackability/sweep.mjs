// Provisional concept-shape study, NOT a replay of final meshes or the game state machine.
import R from '@dimforge/rapier3d-compat';
import {Quaternion,Euler} from 'three';
import fs from 'node:fs';
await R.init();
const box=(h,p,d=1,r=.04)=>({h,p,d,r});
const shapes={};
// Read existing collider dimensions and densities directly from production source.
const source=fs.readFileSync(new URL('../../src/main.ts',import.meta.url),'utf8');
const block=source.slice(source.indexOf('function addAnimalColliders'),source.indexOf('function createAnimal'));
const entries=[...block.matchAll(/roundCuboid\(([^)]+)\)\.setTranslation\(([^)]+)\), ([\d.]+)\)/g)];
for(const [i,n] of ['tortoise','capybara','toucan'].entries()) shapes[n]=entries.slice(i*4,i*4+4).map(m=>{const a=m[1].split(',').map(Number);return box(a.slice(0,3),m[2].split(',').map(Number),+m[3],a[3]);});
if(entries.length!==12) throw Error('Production collider extraction changed');
shapes.armadillo=[box([.72,.85,.32],[0,0,0],1,.14),box([.56,.72,.07],[0,0,.42],.4),box([.29,.36,.22],[0,-1.05,-.13],.3),box([.60,.72,.08],[0,0,-.43],2.4)];
shapes.dragonfly=[box([.27,.55,.25],[0,-.12,0],1),box([.2,.68,.15],[0,.92,.02],.4),box([.39,.3,.24],[0,-.85,0],.5),box([.25,.46,.07],[0,-.1,-.38],1.5)];
for(const x of [-1,1])for(const y of [-.38,.38])shapes.dragonfly.push(box([.70,.22,.07],[x*.90,y,.10],.22,.07));
shapes.ram=[box([.60,.70,.45],[0,.15,0],1,.15),box([.37,.36,.44],[0,-.60,.43],.6,.10),box([.28,.23,.24],[0,-.93,.26],.3)];
for(const x of [-.40,.40])for(const y of [-.38,.66])shapes.ram.push(box([.14,.18,.24],[x,y,-.63],1.3));
// Segment each horn as a curved series, preserving the open center (not a solid box).
for(const x of [-.56,.56])for(let i=0;i<9;i++){const t=i/8*5.2,r=.39*(1-.55*i/8);shapes.ram.push(box([.12,.13,.13],[x,-.58+r*Math.sin(t),.61+r*Math.cos(t)],.65,.05));}
shapes.zebra=[box([.50,.77,.39],[0,.16,0],1,.12),box([.33,.28,.48],[0,-.53,.51],.8,.09),box([.29,.43,.25],[0,-.87,.87],.5,.07)];
for(const x of [-.34,.34])for(const y of [-.38,.70])shapes.zebra.push(box([.13,.17,.25],[x,y,-.57],1.2));
const q=(x,y,z)=>new Quaternion().setFromEuler(new Euler(x,y,z));
const poses=[];
for(const [label,x,y] of [['upright',0,0],['pitch15',Math.PI/12,0],['pitch30',Math.PI/6,0],['roll15',0,Math.PI/12],['roll30',0,Math.PI/6],['side',0,Math.PI/2],['nose',Math.PI/2,0],['upside',Math.PI,0]])for(let i=0;i<4;i++)poses.push({label,yaw:i,rotation:q(x,y,i*Math.PI/2)});
function fixture(w,n,p,rot,fixed=false,tweak=false){
 const b=w.createRigidBody((fixed?R.RigidBodyDesc.fixed():R.RigidBodyDesc.dynamic().setLinearDamping(.42).setAngularDamping(1.45).setCcdEnabled(true)).setTranslation(...p).setRotation(rot));
 let ss=structuredClone(shapes[n]);
 if(tweak&&n==='dragonfly')ss=ss.map(s=>{if(Math.abs(s.p[0])>.5)s.p[2]=.32;return s;});
 if(tweak&&['ram','zebra'].includes(n))ss=ss.map(s=>{if(s.p[2]<-.5){s.p[0]*=1.3;s.h[0]*=1.2;}return s;});
 if(tweak&&n==='armadillo'){ss[1].h[0]=.68;ss[1].h[1]=.80;}
 const cs=ss.map(s=>w.createCollider(R.ColliderDesc.roundCuboid(...s.h,s.r).setTranslation(...s.p).setDensity(s.d).setFriction(fixed?1.08:.25).setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitution(0),b));
 return {b,cs,first:false,quiet:0};
}
function touch(a,b,dist=.005){return a.cs.some(c=>b.cs.some(d=>{const k=c.contactCollider(d,dist);return k&&k.distance<=dist;}));}
function lower(w,a,others,x=0,y=-.25){
 let safe=8;
 for(let z=8;z>-.5;z-=.035){a.b.setTranslation({x,y,z},false);w.propagateModifiedBodyPositionsToColliders();if(others.some(o=>touch(a,o,0))){a.b.setTranslation({x,y,z:safe},true);w.propagateModifiedBodyPositionsToColliders();a.b.setLinvel({x:0,y:0,z:-.05},true);return;}safe=z;}
 throw Error('No surface during placement');
}
function advance(w,all,ground,steps=600){let maxUp=0,calm=0;
 for(let i=0;i<steps;i++){
 w.step();
 for(const a of all.filter(a=>a.b.isDynamic())){
 const v=a.b.linvel(),vlen=Math.hypot(v.x,v.y,v.z),av=a.b.angvel(),alen=Math.hypot(av.x,av.y,av.z);
 maxUp=Math.max(maxUp,v.z);
 if(touch(a,ground,0)||a.b.translation().z<-.5)return {outcome:'fall',maxUp};
 const support=all.some(o=>o!==a&&touch(a,o));
 if(support&&!a.first){a.first=true;a.b.setLinvel({x:v.x*.45,y:v.y*.45,z:Math.min(0,v.z)},true);a.b.setAngvel({x:av.x*.55,y:av.y*.55,z:av.z*.55},true);}
 if(a.b.isSleeping())for(const c of a.cs)c.setFriction(1.08);
 a.quiet=support&&(a.b.isSleeping()||(vlen<.10&&alen<.15))?a.quiet+1:0;
 }
 calm=all.filter(a=>a.b.isDynamic()).every(a=>a.quiet>=60)?calm+1:0;
 }
 return {outcome:calm>0?'stable':'moving',maxUp};
}
function run(support,incoming,pose,tweak){
 const w=new R.World({x:0,y:0,z:-9.81});w.timestep=1/60;
 const gb=w.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,0,-.25));const ground={b:gb,cs:[w.createCollider(R.ColliderDesc.cuboid(8,8,.25),gb)]};
 const base=fixture(w,'tortoise',[0,0,.65],q(0,0,0),true);
 let all=[base];
 if(support!=='base'){
 const a=fixture(w,support,[0,0,8],q(0,0,0),false,tweak);lower(w,a,[base,ground]);all.push(a);
 const prep=advance(w,all,ground,360);if(prep.outcome!=='stable'){w.free();return {outcome:'support_'+prep.outcome,maxUp:prep.maxUp};}
 }
 const a=fixture(w,incoming,[0,0,8],pose.rotation,false,tweak);lower(w,a,[...all,ground]);all.push(a);
 const result=advance(w,all,ground);w.free();return result;
}
const results=[];
for(const tweak of [false,true])for(const support of ['base','tortoise','capybara','toucan','armadillo','dragonfly','ram','zebra'])for(const incoming of ['armadillo','dragonfly','ram','zebra'])for(const pose of poses){results.push({tweak,support,incoming,pose:pose.label,yaw:pose.yaw,...run(support,incoming,pose,tweak)});}
fs.writeFileSync(new URL('results.json',import.meta.url),JSON.stringify({method:'Provisional manually proportioned compound proxies; gentle non-overlap placement; dynamic support on fixed tortoise; 10 second observation; 32 poses; not production state-machine scoring',shapes,results},null,2));
for(const tweak of [false,true])for(const incoming of ['armadillo','dragonfly','ram','zebra']){
 const r=results.filter(r=>r.tweak===tweak&&r.incoming===incoming),near=r.filter(r=>!['side','nose','upside'].includes(r.pose));
 console.log(JSON.stringify({tweak,incoming,total:r.length,stable:r.filter(r=>r.outcome==='stable').length,near:near.length,nearStable:near.filter(r=>r.outcome==='stable').length,supportUnavailable:r.filter(r=>r.outcome.startsWith('support_')).length,moving:r.filter(r=>r.outcome==='moving').length,maxUp:Math.max(...r.map(r=>r.maxUp))}));}
