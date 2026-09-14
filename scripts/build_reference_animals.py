"""Reference-led Blender sculptures. No runtime exports or physics proxies.

Run in a fresh background Blender process. Models remain at their authored
origin, with editable parts/materials and review cameras in the saved source.
"""
import bpy, bmesh, math, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/previews/reference-models'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene; scene.name='Menagerie - reference matched sculptures'
active=None
def material(name,color,rough=.30):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1)
 p.inputs['Roughness'].default_value=rough;p.inputs['Coat Weight'].default_value=.24;p.inputs['Coat Roughness'].default_value=.25
 return m
brick=material('Armadillo - brick red',(.28,.045,.032)); coral=material('Armadillo - coral',(.40,.075,.045)); deepred=material('Armadillo - russet',(.18,.025,.018)); seam=material('Armadillo - pale clay seams',(.70,.35,.25))
teal=material('Dragonfly - deep petrol',(.040,.135,.160)); tailteal=material('Dragonfly - blue teal',(.055,.19,.215)); sage=material('Dragonfly - sage',(.25,.43,.33)); wing=material('Dragonfly - pale celadon',(.53,.70,.65)); vein=material('Dragonfly - recessed veins',(.23,.40,.37),.40)
oatmeal=material('Ram - warm oatmeal',(.83,.74,.57),.34); muzzle=material('Ram - dusty mauve',(.17,.095,.10)); ochre=material('Ram - honey ochre',(.76,.43,.10)); hornlight=material('Ram - horn facets',(.83,.49,.135))
plum=material('Skunk - charcoal plum',(.045,.022,.036),.29); earinner=material('Ear inner glaze',(.24,.13,.145),.38); ivory=material('Ivory markings',(.94,.82,.63),.32)
eye=material('Glossy obsidian',(.003,.006,.007),.10); shine=material('Eye catchlight',(.98,.97,.88),.18); mouth=material('Quiet mouth',(.13,.10,.085),.45)
mouth.node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value=0
floor=material('Backdrop sage',(.61,.73,.65),.65); porcelain=material('Ivory display plinth',(.84,.84,.73),.50)

def start(name):
 global active
 active=bpy.data.objects.new(name,None);scene.collection.objects.link(active);return active
def finish(o,name,m):
 o.name=name;o.data.materials.append(m)
 if active:o.parent=active
 return o
def soften(o,width=.05,segments=6):
 for poly in o.data.polygons:poly.use_smooth=True
 b=o.modifiers.new('Soft ceramic edges','BEVEL');b.width=width;b.segments=segments;b.harden_normals=True
 b=o.modifiers.new('Weighted broad face normals','WEIGHTED_NORMAL');b.keep_sharp=True
 return o
def box(name,p,h,m,b=.13):
 bpy.ops.mesh.primitive_cube_add(size=2,location=p);o=bpy.context.object;o.scale=h
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return soften(finish(o,name,m),b)
def orb(name,p,h,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=p);o=bpy.context.object;o.scale=h
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for f in o.data.polygons:f.use_smooth=True
 return finish(o,name,m)
def mesh(name,v,f,m,b=.035):
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free();o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);finish(o,name,m)
 if b:soften(o,b)
 return o
def line(name,pts,m,r=.012):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=12;d.bevel_depth=r;d.bevel_resolution=3;d.use_fill_caps=True
 s=d.splines.new('POLY');s.points.add(len(pts)-1)
 for v,p in zip(s.points,pts):v.co=(*p,1)
 o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);return finish(o,name,m)

# Rounded, broadly planar cross-section, with explicit central stripe boundaries.
SECTION=[(-1,.60),(-.83,1),(-.35,1),(.35,1),(.83,1),(1,.60),(1,-.60),(.83,-1),(.35,-1),(-.35,-1),(-.83,-1),(-1,-.60)]
def loft(name,rings,m,b=.06,striped=False):
 # Rings: (y, centerZ, halfWidth, halfHeight).
 n=len(SECTION)
 # NOTE: assign coordinates from our canonical broad-face section.
 v=[]
 for y,cz,rx,rz in rings:
  v.extend((x*rx,y,cz+z*rz) for x,z in SECTION)
 f=[tuple(range(n-1,-1,-1)),tuple(range((len(rings)-1)*n,len(rings)*n))]
 f.extend((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j) for i in range(len(rings)-1) for j in range(n))
 o=mesh(name,v,f,m,b)
 if striped:
  o.data.materials.append(ivory)
  for poly in o.data.polygons:
   if poly.index>=2 and (poly.index-2)%n==2:poly.material_index=1
 return o
def pupils(points,r=.08):
 for x,y,z in points:
  orb('Living eye',(x,y,z),(r,r*.75,r),eye)
  orb('Eye glimmer',(x-.021,y-r*.60,z+.026),(r*.19,r*.10,r*.19),shine)
def smile(y,z,width=.13):
 line('Understated smile',[(-width,y,z+.02),(-width*.35,y-.018,z),(width*.35,y-.018,z),(width,y,z+.02)],mouth,.012)
def feet(xs,ys,pz,h,m):
 for x in xs:
  for y in ys:box('Tucked foot',(x,y,pz),h,m,min(h)*.65)
def catmull(points,steps=6):
 p=[Vector(v) for v in points];out=[]
 for i in range(len(p)-1):
  a,b,c,d=p[max(0,i-1)],p[i],p[i+1],p[min(len(p)-1,i+2)]
  for j in range(steps):
   t=j/steps;out.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
 out.append(p[-1]);return out

roots={}
roots['armadillo']=start('ARMADILLO - fitted faceted armor')
feet([-.62,.62],[-.62,.68],.19,(.24,.31,.19),deepred)
box('Rounded low belly',(0,.07,.42),(.73,.95,.24),deepred,.18)
# Shell has a long flat crown, shaped shoulders and a tapered rump, not a stack of slabs.
shell_rings=[(-.98,.68,.64,.38),(-.77,.80,.80,.52),(-.43,.81,.86,.59),(.02,.81,.87,.61),(.46,.79,.84,.60),(.78,.74,.76,.53),(.99,.67,.61,.40)]
loft('Pale clay beneath armor',shell_rings,seam,.065)
for k in range(len(shell_rings)-1):
 a,b=shell_rings[k:k+2]
 # Insets leave narrow flush seams; tapered widths retain a continuous silhouette.
 mid=(a[0]+b[0])/2;rr=[]
 for ring in [a,b]:
  y,z,w,h=ring;rr.append((mid+(y-mid)*.975,z,w+.008,h+.006))
 loft('Fitted armor band %02d'%k,rr,[coral,brick,coral,deepred,brick,coral][k],.035)
loft('Tapered cheek and wedge snout',[(-1.81,.51,.24,.18),(-1.55,.65,.37,.27),(-1.18,.77,.46,.35),(-.94,.77,.43,.31)],coral,.08)
for side in [-1,1]:
 ear=orb('Upturned ear',(side*.47,-1.045,1.04),(.125,.09,.245),brick);ear.rotation_euler.y=side*.46
 inner=orb('Cream ear interior',(side*.478,-1.125,1.08),(.075,.023,.155),ivory);inner.rotation_euler.y=side*.46
pupils([(-.335,-1.61,.70),(.335,-1.61,.70)],.077)
smile(-1.825,.465,.16)
loft('Tapered tail',[(.90,.42,.16,.135),(1.24,.48,.10,.085),(1.56,.51,.025,.025)],coral,.025)
for y in [1.09,1.27]:line('Tail division',[(-.07,y,.54),(0,y,.575),(.07,y,.54)],brick,.012)

roots['dragonfly']=start('DRAGONFLY - broad carved wings')
feet([-.29,.29],[-.70,-.10,.45],.20,(.085,.12,.20),teal)
loft('Sculpted thorax',[(-.86,.67,.31,.30),(-.42,.71,.40,.34),(.06,.72,.38,.32),(.42,.73,.30,.26)],teal,.095)
loft('Small squared face',[(-1.27,.58,.25,.23),(-1.03,.63,.29,.29),(-.80,.66,.31,.30)],teal,.09)
for x in [-.36,.36]:orb('Large sage eye lobe',(x,-1.02,.67),(.245,.225,.295),sage)
pupils([(-.405,-1.212,.70),(.405,-1.212,.70)],.075)
smile(-1.285,.46,.105)
for i in range(6):
 y=.40+i*.285;w=.30-i*.035;z=.74+i*.013;h=.25-i*.023
 loft('Broad abdomen segment %02d'%i,[(y-.13,z,w,h),(y+.13,z,w*.91,h*.94)],sage if i==3 else tailteal,.063)
for side in [-1,1]:
 for rear in [False,True]:
  # Wings are broad paddle/leaf forms with a tapered root, not rectangular bars.
  rooty=.18 if rear else -.52;direction=1 if rear else -1
  poly=[(.30,0),(.79,-.08),(1.66,.23),(1.96,.42),(2.01,.64),(1.89,.81),(1.57,.78),(.73,.37),(.31,.19)]
  n=len(poly);v=[]
  for z in [.635,.82]:
   v.extend((side*x,rooty+direction*y,z+.025*(x-.3)) for x,y in poly)
  f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
  o=mesh('Broad ceramic wing '+('rear' if rear else 'front'),v,f,wing,.078)
  # Actual shallow engraved channels, cut into the ceramic face.
  paths=[[(.46,.13),(1.68,.56)],[(1.13,.36),(1.48,.62)],[(1.13,.36),(1.54,.32)]]
  bpy.context.view_layer.objects.active=o
  for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
  for path in paths:
   cutter=line('Vein cutting tool',[(side*x,rooty+direction*y,.824+.025*(x-.3)) for x,y in path],wing,.014)
   bpy.ops.object.select_all(action='DESELECT');cutter.select_set(True);bpy.context.view_layer.objects.active=cutter
   bpy.ops.object.convert(target='MESH');cutter=bpy.context.object
   bpy.context.view_layer.objects.active=o
   cut=o.modifiers.new('Engraved wing channel','BOOLEAN');cut.operation='DIFFERENCE';cut.solver='EXACT';cut.object=cutter
   bpy.ops.object.modifier_apply(modifier=cut.name)
   bpy.data.objects.remove(cutter,do_unlink=True)
  o.modifiers.new('Carved face normals','WEIGHTED_NORMAL')

roots['ram']=start('RAM - plain fleece and full spiral horns')
feet([-.49,.49],[-.52,.79],.22,(.215,.255,.22),muzzle)
box('Plain softly squared fleece',(0,.18,.92),(.72,.98,.62),oatmeal,.26)
box('Broad forehead',(0,-.68,1.43),(.50,.46,.59),oatmeal,.24)
box('Soft square mauve muzzle',(0,-1.13,1.23),(.33,.285,.32),muzzle,.14)
for side in [-1,1]:
 orb('Small sideways ear',(side*.57,-.86,1.54),(.22,.15,.105),muzzle)
 # A complete tapering spiral with a tucked center, and broad ceramic facets.
 pts=[];count=43
 for i in range(count):
  u=i/(count-1);t=-.8+u*7.5;r=.52*(1-.79*u)
  pts.append(Vector((side*(.38+.26*min(1,u*10)),-.62+r*math.sin(t),1.71+r*math.cos(t)-.22*(1-min(1,u*10)))))
 v=[];sides=10
 for i,p in enumerate(pts):
  u=i/(count-1);tangent=(pts[min(i+1,count-1)]-pts[max(i-1,0)]).normalized();a=Vector((1,0,0));b=tangent.cross(a).normalized()
  radius=.18-.075*u
  for j in range(sides):v.append(p+radius*(a*math.cos(j*math.tau/sides)+b*math.sin(j*math.tau/sides)))
 f=[tuple(range(sides-1,-1,-1)),tuple(range((count-1)*sides,count*sides))]+[(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j) for i in range(count-1) for j in range(sides)]
 horn=mesh('Full faceted spiral horn',v,f,ochre,.018);horn.data.materials.append(hornlight)
 for p in horn.data.polygons:
  if p.index>=2 and (p.index-2)//sides%8==0:p.material_index=1
pupils([(-.356,-1.106,1.60),(.356,-1.106,1.60)],.085)
for x in [-.356,.356]:box('Relaxed eyelid',(x,-1.149,1.653),(.100,.036,.034),muzzle,.024)
for x in [-.145,.145]:orb('Nostril',(x,-1.409,1.32),(.030,.014,.022),mouth)
smile(-1.421,1.10,.13)
orb('Small tail',(0,1.10,1.00),(.16,.23,.18),oatmeal)

roots['skunk']=start('SKUNK - low broad S curl')
feet([-.56,.56],[-.64,.68],.20,(.215,.30,.20),plum)
loft('Continuous striped body',[(-.96,.69,.49,.44),(-.68,.73,.67,.53),(.40,.73,.70,.54),(.82,.72,.64,.49),(1.02,.69,.50,.41)],plum,.11,True)
loft('Tapered striped head',[(-1.70,.44,.23,.17),(-1.50,.54,.34,.25),(-1.28,.63,.43,.32),(-.93,.71,.45,.36)],plum,.075,True)
for side in [-1,1]:
 e=orb('Small round ear',(side*.43,-1.00,1.02),(.13,.09,.19),plum);e.rotation_euler.y=side*.18
 orb('Mauve ear inset',(side*.43,-1.075,1.035),(.075,.025,.112),earinner)
pupils([(-.345,-1.51,.65),(.345,-1.51,.65)],.084)
orb('Tiny button nose',(0,-1.715,.45),(.069,.038,.048),eye)
smile(-1.715,.355,.10)
# A substantial flattened ceramic ribbon; smooth continuous S silhouette.
points=[(.82,.75),(1.22,.84),(1.66,1.07),(1.75,1.36),(1.59,1.66),(1.74,1.86),(2.10,1.88),(2.40,1.77)]
curves=[[(.85,.75),(2.0,.75),(1.65,1.30),(1.60,1.45)],[(1.60,1.45),(1.55,1.60),(1.35,1.95),(2.05,1.95)],[(2.05,1.95),(2.30,1.95),(2.50,1.92),(2.50,1.75)]]
path=[]
for curve in curves:
 a,b,c,d=map(Vector,curve)
 for i in range(24):
  t=i/24;path.append((1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d)
path.append(Vector(curves[-1][-1]));v=[];n=len(SECTION)
for i,p in enumerate(path):
 u=i/(len(path)-1);t=(path[min(i+1,len(path)-1)]-path[max(0,i-1)]).normalized();normal=Vector((-t.y,t.x))
 w=.43+.25*min(1,u*2.7);depth=.17
 # Round the very end without reducing the whole upper curl to a narrow tube.
 if u>.95:depth*=1-.40*((u-.95)/.05)
 for x,z in SECTION:v.append((w*x,p.x+normal.x*depth*z,p.y+normal.y*depth*z))
f=[tuple(range(n-1,-1,-1)),tuple(range((len(path)-1)*n,len(path)*n))]+[(i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j) for i in range(len(path)-1) for j in range(n)]
tail=mesh('Broad continuous lowered tail',v,f,plum,0);tail.data.materials.append(ivory)
for poly in tail.data.polygons:poly.use_smooth=True
sub=tail.modifiers.new('Continuous soft curl surface','SUBSURF');sub.levels=2;sub.render_levels=2
for p in tail.data.polygons:
 if p.index>=2 and (p.index-2)%n in [2,8]:p.material_index=1

# Studio: this file contains the actual editable geometry shown in every render.
active=None
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=2.32,depth=.14,location=(0,0,-.07));plinth=soften(finish(bpy.context.object,'Display plinth',porcelain),.06)
box('Backdrop',(0,0,-.22),(200,200,.06),floor,.01)
world=bpy.data.worlds.new('Soft studio world');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.73,.82,.77,1);world.node_tree.nodes['Background'].inputs[1].default_value=.32
for name,p,power,size in [('Key',(-4,-5,7),850,5),('Fill',(5,-2,4),300,5),('Rim',(1,5,6),700,4)]:
 bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(5,-8,4.5));camera=bpy.context.object;camera.name='Review camera';scene.camera=camera;camera.data.type='ORTHO'
scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.render.resolution_x=1200;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
def show(name):
 for key,root in roots.items():
  for o in [root,*root.children_recursive]:o.hide_render=key!=name;o.hide_set(key!=name)
 target={'armadillo':(0,-.05,.65),'dragonfly':(0,.15,.55),'ram':(0,-.02,1.0),'skunk':(0,.10,.80)}[name]
 camera.location=Vector(target)+Vector((5,-8,4.1));camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
 camera.data.ortho_scale=5.1 if name=='dragonfly' else 4.8
 plinth.scale=(1.08,1.08,1) if name=='dragonfly' else (1,1,1)
show('armadillo')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/source/menagerie-reference-rebuild.blend'))
requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(roots)
for name in requested:
 show(name);scene.render.filepath=str(OUT/f'{name}.png');bpy.ops.render.render(write_still=True)
