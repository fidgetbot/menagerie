import fs from 'node:fs/promises';import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.self=globalThis;await fs.mkdir("tmp",{recursive:true});
const hulls=JSON.parse(await fs.readFile('src/expansion-colliders.json','utf8'));const result={};
for(const name of Object.keys(hulls)){
 const b=await fs.readFile(`public/models/${name}.glb`);const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');gltf.scene.rotation.x=Math.PI/2;gltf.scene.updateMatrixWorld(true);
 const visual=new T.Box3().setFromObject(gltf.scene);const physical=new T.Box3();let triangles=0;const visualPoints=[];const hullPoints=[];
 gltf.scene.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;const attr=o.geometry.attributes.position;for(let i=0;i<attr.count;i++)visualPoints.push(new T.Vector3().fromBufferAttribute(attr,i).applyMatrix4(o.matrixWorld));}});
 for(const h of hulls[name])for(let i=0;i<h.vertices.length;i+=3){const p=new T.Vector3(...h.vertices.slice(i,i+3));physical.expandByPoint(p);hullPoints.push(p);}
 let worstBoundsGap=0;let poses=0;
 for(const axis of ['x','y'])for(const degrees of [0,30,90,180])for(const yaw of [0,90]){
  const q=new T.Quaternion().setFromEuler(new T.Euler(axis==='x'?degrees*Math.PI/180:0,axis==='y'?degrees*Math.PI/180:0,yaw*Math.PI/180));
  const vb=new T.Box3(),hb=new T.Box3();for(const p of visualPoints)vb.expandByPoint(p.clone().applyQuaternion(q));for(const p of hullPoints)hb.expandByPoint(p.clone().applyQuaternion(q));
  for(const axis of ['x','y','z'])worstBoundsGap=Math.max(worstBoundsGap,Math.abs(vb.min[axis]-hb.min[axis]),Math.abs(vb.max[axis]-hb.max[axis]));poses++;
 }
 if(worstBoundsGap>.08)throw Error(`Bounds mismatch ${name}: ${worstBoundsGap}`);
 result[name]={poses,worstBoundsGap,visualMin:visual.min.toArray(),visualMax:visual.max.toArray(),colliderMin:physical.min.toArray(),colliderMax:physical.max.toArray(),triangles};
 if(!Number.isFinite(triangles)||triangles===0)throw Error('Empty export');
}
await fs.writeFile('tmp/reference-alignment.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
