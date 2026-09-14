"""Export review sculptures and geometry-derived convex collision pieces together."""
import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/source/menagerie-reference-rebuild.blend'))
(ROOT/'tmp').mkdir(exist_ok=True)
SCALES={"armadillo":.9,"dragonfly":.72,"ram":.9,"skunk":.9}
OFFSET=Vector((0,0,.72))
roots={s:next(o for o in bpy.data.objects if o.type=='EMPTY' and o.name.startswith(s.upper())) for s in ['armadillo','dragonfly','ram','skunk']}
result={};report={}
def hull(points):
 bm=bmesh.new()
 for p in points:bm.verts.new(p)
 out=bmesh.ops.convex_hull(bm,input=list(bm.verts),use_existing_faces=False)
 verts={v for f in out['geom'] if isinstance(f,bmesh.types.BMFace) for v in f.verts}
 values=sorted(tuple(round(c,5) for c in v.co) for v in verts)
 bm.free()
 return [c for p in values for c in p]
for species,root in roots.items():
 SCALE=SCALES[species]
 parts=[];shell=[]
 for o in root.children_recursive:
  o.hide_set(False);o.hide_render=False
  if o.type!='MESH':continue
  name=o.name
  if any(word in name.lower() for word in ['eye','glimmer','nostril','inset','nose']):continue
  if name.startswith('Broad continuous lowered tail') or name.startswith('Full faceted spiral horn'):
   width=12 if 'tail' in name else 10
   step=5 if 'tail' in name else 4
   count=len(o.data.vertices)//width
   for i in range(0,count-1,step):
    points=[(o.matrix_world@v.co-OFFSET)*SCALE for v in list(o.data.vertices)[i*width:min(count,i+step+1)*width]]
    parts.append({'name':name+f' section {i}','vertices':hull(points),'d':.35})
   continue
  ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh()
  points=[(o.matrix_world@v.co-OFFSET)*SCALE for v in me.vertices]
  ev.to_mesh_clear()
  if species=='armadillo' and any(word in name.lower() for word in ['armor','shell']):shell+=points;continue
  parts.append({'name':name,'vertices':hull(points),'d':1.8 if 'foot' in name.lower() else .22 if 'wing' in name.lower() else .8})
 if shell:parts.append({'name':'Fitted armor envelope','vertices':hull(shell),'d':.8})
 result[species]=parts
 # Same transform for the displayed vertices and every collision vertex.
 root.location=-OFFSET*SCALE;root.scale=(SCALE,)*3
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
 for o in root.children_recursive:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models'/f'{species}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
 report[species]={'colliders':len(parts),'hullVertices':sum(len(p['vertices'])//3 for p in parts),'bytes':(ROOT/'public/models'/f'{species}.glb').stat().st_size}
(ROOT/'src/expansion-colliders.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
(ROOT/'tmp/reference-export-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
