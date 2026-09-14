"""Approved expansion: offline Blender build, editable source and runtime GLBs.
Coordinates are shared with expansion-colliders.json; do not recenter exports.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
def mat(name,c,rough=.36):
 m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.use_nodes=True
 p=m.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value=(*c,1); p.inputs['Roughness'].default_value=rough
 p.inputs['Coat Weight'].default_value=.18; p.inputs['Coat Roughness'].default_value=.27
 return m
red=mat('Brick red',(.49,.115,.09)); coral=mat('Coral',(.72,.23,.17)); blush=mat('Blush seams',(.88,.55,.40))
teal=mat('Deep teal',(.045,.20,.23)); celadon=mat('Celadon wings',(.43,.67,.60)); mint=mat('Mint eyes',(.20,.43,.32)); vein=mat('Wing veins',(.19,.40,.37))
cream=mat('Oatmeal',(.86,.76,.56)); mauve=mat('Mauve muzzle',(.26,.17,.17)); gold=mat('Ochre horns',(.73,.43,.105))
plum=mat('Charcoal plum',(.105,.063,.085)); ivory=mat('Ivory stripe',(.94,.80,.58)); black=mat('Glossy eyes',(.004,.008,.009),.12)
active=None
def finish(o,name,m):
 o.name=name; o.data.materials.append(m); o.parent=active; return o
def bevel(o,b):
 mod=o.modifiers.new('Soft edges','BEVEL'); mod.width=b; mod.segments=3
 o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); return o
def box(name,p,h,m,b=.08):
 bpy.ops.mesh.primitive_cube_add(size=2,location=p); o=bpy.context.object; o.scale=h
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return bevel(finish(o,name,m),b)
def orb(name,p,h,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=p); o=bpy.context.object; o.scale=h
 for f in o.data.polygons:f.use_smooth=True
 return finish(o,name,m)
def mesh(name,v,f,m,b=.035):
 d=bpy.data.meshes.new(name); d.from_pydata(v,[],f); d.update(); o=bpy.data.objects.new(name,d); scene.collection.objects.link(o)
 return bevel(finish(o,name,m),b)
def line(name,pts,m,r=.012):
 d=bpy.data.curves.new(name,'CURVE'); d.dimensions='3D'; d.bevel_depth=r; d.bevel_resolution=2
 s=d.splines.new('POLY'); s.points.add(len(pts)-1)
 for v,p in zip(s.points,pts):v.co=(*p,1)
 o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); return finish(o,name,m)
def extrude(name,profile,width,m):
 # Profile in Y/Z, extruded along X.
 n=len(profile); v=[(x,y,z) for x in [-width,width] for y,z in profile]
 f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 return mesh(name,v,f,m,.055)
def face(y,z,x=.22):
 for side in [-1,1]:
  orb('Living eye',(side*x,y,z),(.070,.048,.076),black)
  orb('Eye glimmer',(side*x-.017,y-.038,z+.022),(.015,.010,.015),ivory)
 line('Quiet smile',[(-.10,y-.02,z-.14),(0,y-.03,z-.17),(.10,y-.02,z-.14)],mauve)
def feet(xs,ys,z,h,m):
 for x in xs:
  for y in ys:box('Living foot',(x,y,z),h,m,.065)
def start(name):
 global active
 active=bpy.data.objects.new(name,None); scene.collection.objects.link(active); return active
roots=[]
roots.append(start('armadillo'))
box('Low belly',(0,0,-.20),(.73,.86,.31),red,.16)
# Broad polygonal armor bands, with a truly flat crown and narrow pale seams.
profile=[(-.76,-.29),(-.82,.10),(-.65,.37),(-.46,.49),(.46,.49),(.65,.37),(.82,.10),(.76,-.29)]
for i in range(5):
 y=-.76+i*.37; n=len(profile)
 v=[(x,yy,z) for yy in [y-.172,y+.172] for x,z in profile]
 f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
 mesh('Broad armor band',v,f,coral if i%2==0 else red,.035)
 line('Blush armor seam',[(x,y+.18,z+.006) for x,z in profile[:5]],blush,.009)
extrude('Wedge head',[(-.80,-.30),(-1.36,-.28),(-1.47,-.06),(-1.13,.17),(-.80,.13)],.29,coral)
for x in [-.29,.29]:
 orb('Folded ear',(x,-1.0,.25),(.11,.08,.20),red); orb('Ear inset',(x,-1.076,.26),(.060,.018,.12),blush)
face(-1.36,-.015,.23)
feet([-.58,.58],[-.63,.59],-.43,(.20,.23,.11),red)
extrude('Tapered tail',[(.78,-.30),(1.38,-.13),(.85,-.02)],.12,coral)
roots.append(start('dragonfly'))
box('Thorax',(0,-.12,0),(.30,.58,.28),teal,.12)
for i in range(5):
 box('Abdomen segment',(0,.52+i*.245,.015),(.23-i*.022,.15,.18-i*.012),mint if i==2 else teal,.075)
box('Small face',(0,-.84,-.02),(.28,.30,.25),teal,.10)
for x in [-.32,.32]:orb('Eye lobe',(x,-.87,.04),(.19,.22,.24),mint)
face(-1.071,.045,.33)
for side in [-1,1]:
 for y in [-.38,.38]:
  # Beveled tapered wing with broad planar load-bearing face.
  pts=[(.28,y-.12),(1.48,y-.23),(1.62,y-.11),(1.57,y+.19),(.90,y+.24),(.28,y+.12)]
  v=[(side*x,yy,z) for z in [.03,.17] for x,yy in pts]; n=len(pts)
  mesh('Substantial ceramic wing',v,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)],celadon,.06)
  line('Main wing vein',[(side*.40,y,.181),(side*1.40,y+.02,.181)],vein,.009)
  line('Branch vein',[(side*.88,y+.01,.182),(side*1.20,y+.14,.182)],vein,.008)
feet([-.29,.29],[-.45,0,.43],-.33,(.075,.11,.16),teal)
roots.append(start('ram'))
box('Plain fleece body',(0,.15,0),(.65,.75,.50),cream,.22)
box('Quiet head',(0,-.60,.43),(.40,.40,.47),cream,.18)
box('Squared muzzle',(0,-.99,.25),(.29,.23,.25),mauve,.10)
feet([-.40,.40],[-.38,.66],-.63,(.17,.21,.24),mauve)
for x in [-.56,.56]:
 # Continuous faceted spiral tube, open center; no fleece markings.
 pts=[]
 for i in range(25):
  t=i/24*7.0; r=.39*(1-.75*i/24); pts.append((x,-.58+r*math.sin(t),.61+r*math.cos(t)))
 v=[]
 for i,p in enumerate(pts):
  tangent=Vector(pts[min(i+1,24)])-Vector(pts[max(0,i-1)]); tangent.normalize(); u=Vector((1,0,0)); w=tangent.cross(u).normalized()
  for j in range(8):v.append(Vector(p)+(.14-.025*i/24)*(u*math.cos(j*math.pi/4)+w*math.sin(j*math.pi/4)))
 f=[tuple(range(7,-1,-1)),tuple(range(24*8,25*8))]+[(i*8+j,i*8+(j+1)%8,(i+1)*8+(j+1)%8,(i+1)*8+j) for i in range(24) for j in range(8)]
 mesh('Faceted spiral horn',v,f,gold,.016)
for x in [-.44,.44]:orb('Sideways ear',(x,-.76,.52),(.19,.12,.085),mauve)
face(-1.01,.57,.29)
for x in [-.29,.29]:box('Unimpressed eyelid',(x,-1.042,.62),(.085,.035,.033),cream,.018)
orb('Tail',(0,.88,.12),(.14,.20,.16),cream)
roots.append(start('skunk'))
box('Low exposed back',(0,0,0),(.59,.83,.39),plum,.17)
box('Ivory back stripe',(0,-.015,.388),(.18,.75,.009),ivory,.008)
extrude('Small wedge head',[(-.73,-.28),(-1.29,-.26),(-1.37,-.12),(-1.02,.12),(-.73,.10)],.28,plum)
stripe=[(-.75,.115,.12),(-1.02,.13,.105),(-1.33,-.081,.065)]
mesh('Forehead stripe',[(x,y,z) for y,z,w in stripe for x in [-w,w]],[(0,1,3,2),(2,3,5,4)],ivory,.008)
orb('Tiny nose',(0,-1.362,-.12),(.065,.045,.047),black)
feet([-.38,.38],[-.48,.48],-.42,(.17,.21,.15),plum)
for x in [-.24,.24]:orb('Small ear',(x,-.75,.14),(.09,.08,.13),plum)
face(-1.29,-.07,.23)
# Broad low S-curl, continuous surface with central ivory band.
path=[(.70,-.03),(.94,.06),(1.14,.25),(1.23,.46),(1.18,.65),(1.22,.83),(1.43,.94),(1.65,.90)]
v=[]
for i,(y,z) in enumerate(path):
 a=Vector(path[max(0,i-1)]); b=Vector(path[min(len(path)-1,i+1)]); t=(b-a).normalized(); normal=Vector((-t.y,t.x))
 for j in range(16):
  ang=j*math.tau/16; v.append((.42*math.cos(ang),y+.20*math.sin(ang)*normal.x,z+.20*math.sin(ang)*normal.y))
f=[tuple(range(15,-1,-1)),tuple(range(7*16,8*16))]+[(i*16+j,i*16+(j+1)%16,(i+1)*16+(j+1)%16,(i+1)*16+j) for i in range(7) for j in range(16)]
tail=mesh('Lower broad curled tail',v,f,plum,.035); tail.data.materials.append(ivory)
for p in tail.data.polygons:
 if len(p.vertices)==4:
  j=(p.index-2)%16
  if j in [3,4,11,12]:p.material_index=1

# Save/export separate assets before arranging the presentation scene.
for root in roots:
 bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
 for o in root.children_recursive:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models'/f'{root.name}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
active=None
for root,p in zip(roots,[(-2,-1.7,.55),(2,-1.7,.50),(-2,2,.88),(2,2,.58)]):root.location=p
floor=mat('Studio floor',(.72,.80,.73),.7)
box('Floor',(0,0,-.15),(200,200,.1),floor,.01)
bpy.ops.object.camera_add(location=(8,-13,11)); camera=bpy.context.object; camera.rotation_euler=(Vector((0,0,.5))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=10; scene.camera=camera
for p,power,size in [((1,-5,10),1100,7),((-6,-1,6),700,6),((4,6,8),1000,5)]:
 bpy.ops.object.light_add(type='AREA',location=p); l=bpy.context.object; l.data.energy=power; l.data.shape='DISK'; l.data.size=size; l.rotation_euler=(-l.location).to_track_quat('-Z','Y').to_euler()
scene.world.color=(.25,.25,.25); scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.view_settings.view_transform='AgX'; scene.render.resolution_x=1200; scene.render.resolution_y=1050; scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/source/menagerie-final-expansion.blend'))
scene.render.filepath=str(ROOT/'assets/previews/final-expansion.png'); bpy.ops.render.render(write_still=True)
