"""Menagerie first-look sculptures. Run with Blender Python; no external assets."""
import bpy, math, os
from mathutils import Vector
ROOT = '/Users/fidget/.openclaw/git/menagerie'
scene = bpy.data.scenes.new('Menagerie • Character studies 01')
bpy.context.window.scene = scene
# Independent scene, preserving the previously open project untouched.
def mat(name, rgb, rough=.36):
    m=bpy.data.materials.new('MNG '+name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb,1); p.inputs['Roughness'].default_value=rough
    p.inputs['Coat Weight'].default_value=.18; p.inputs['Coat Roughness'].default_value=.27
    return m
jade=mat('jade',(.055,.36,.23)); mint=mat('mint',(.25,.64,.40)); gold=mat('ochre seams',(.67,.40,.09))
shells=[mat('turquoise '+str(i), c,.28) for i,c in enumerate([(.025,.39,.40),(.025,.49,.47),(.06,.56,.49),(.035,.32,.35)])]
terra=mat('terracotta',(.58,.20,.11),.48); peach=mat('peach',(.83,.38,.21),.45); cream=mat('warm cream',(.95,.73,.43),.4)
indigo=mat('indigo',(.035,.045,.17)); wingmat=mat('wing blue',(.065,.105,.29)); orange=mat('mango',(.98,.43,.045),.25); coral=mat('coral',(.85,.105,.07),.27)
eye=mat('obsidian eyes',(.006,.011,.015),.13); ivory=mat('eye glint',(1,.94,.73),.2); dark=mat('nostrils',(.14,.055,.035),.53)
base=mat('plinth',(.70,.76,.67),.6); floor=mat('background',(.83,.85,.77),.7); ink=mat('lettering',(.065,.13,.14),.6)
active_root=None

def finish(o,name,m):
    o.name=name; o.data.materials.append(m)
    if active_root: o.parent=active_root
    return o

def box(name,loc,scale,m,bevel=.12):
    bpy.ops.mesh.primitive_cube_add(size=2, location=loc); o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,m)
    b=o.modifiers.new('Soft sculpted edges','BEVEL'); b.width=bevel; b.segments=3
    o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o

def orb(name,loc,scale,m,seg=16,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=loc); o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,name,m)
    b=o.modifiers.new('Soft facets','BEVEL'); b.width=.018; b.segments=2
    o.modifiers.new('Weighted facet normals','WEIGHTED_NORMAL')
    return o

def mesh(name,verts,faces,m,bevel=.035):
    d=bpy.data.meshes.new(name); d.from_pydata(verts,[],faces); d.update(); o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); finish(o,name,m)
    b=o.modifiers.new('Rounded plane edges','BEVEL'); b.width=bevel; b.segments=3
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); return o

def root(name,pos,angle):
    global active_root
    o=bpy.data.objects.new(name,None); scene.collection.objects.link(o); o.location=pos; o.rotation_euler.z=angle; active_root=o
    return o

def line(name,coords,m,r=.018):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.bevel_depth=r; c.bevel_resolution=3
    s=c.splines.new('POLY'); s.points.add(len(coords)-1)
    for p,co in zip(s.points,coords): p.co=(*co,1)
    o=bpy.data.objects.new(name,c); scene.collection.objects.link(o); finish(o,name,m); return o

# Tortoise: broad belly, shallow polygonal crown and inset raised shell scutes.
root('TORTOISE | quiet optimist',(-3.35,0,.24),-.22)
box('Broad stable belly',(0,0,.37),(.91,.98,.25),gold,.22)
for x in [-.70,.70]:
    for y in [-.68,.62]:
        o=box('Paddling jade foot',(x,y,.23),(.27,.35,.20),jade,.14)
        for dx in [-.085,.04]: line('Toe crease',[(x+dx,y-.34,.24),(x+dx,y-.31,.32)],mint,.012)
# shell mesh built as rings with flattened crown
N=10
rs=[(1.02,1.13,.48),(1.01,1.12,.73),(.73,.81,1.16),(.34,.38,1.30)]
v=[(rx*math.cos(i*2*math.pi/N),ry*math.sin(i*2*math.pi/N),z) for rx,ry,z in rs for i in range(N)]
f=[tuple(range(N-1,-1,-1))]
for j in range(3):
    for i in range(N): f.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
f.append(tuple(3*N+i for i in range(N)))
mesh('Golden shell foundation',v,f,gold,.055)
for k,face in enumerate(f[1:]):
    pts=[Vector(v[i]) for i in face]; cen=sum(pts,Vector())/len(pts)
    pts=[cen+(p-cen)*.92+Vector((0,0,.025)) for p in pts]
    ob=mesh('Individual shell scute %02d'%k,pts,[tuple(range(len(pts)))],shells[k%4],.025)
    so=ob.modifiers.new('Scute depth','SOLIDIFY'); so.thickness=.03
box('Curious head',(0,-1.14,.64),(.43,.43,.34),mint,.22)
for x in [-.34,.34]:
    orb('Tortoise eye',(x,-1.47,.76),(.105,.075,.11),eye)
    orb('Tortoise eye sparkle',(x-.023,-1.531,.802),(.024,.014,.024),ivory)
line('Quiet smile',[(-.18,-1.556,.54),(0,-1.584,.51),(.18,-1.556,.54)],jade,.018)
orb('Little tail',(0,1.03,.34),(.13,.28,.13),jade)

# Capybara: generous horizontal back and sleepy, square muzzle.
root('CAPYBARA | completely unbothered',(0,0,.24),-.30)
box('Chunky body',(0,.15,.78),(.72,1.02,.59),terra,.29)
box('Broad upper back',(0,.28,1.12),(.65,.85,.26),peach,.23)
for x in [-.49,.49]:
    for y in [-.57,.78]:
        box('Tucked foot',(x,y,.20),(.23,.30,.18),terra,.095)
        for dx in [-.065,.065]: line('Capy toe',[(x+dx,y-.285,.17),(x+dx,y-.275,.25)],dark,.013)
box('Squared head',(0,-.71,1.07),(.65,.63,.54),peach,.24)
box('Cream snout',(0,-1.20,.86),(.55,.27,.30),cream,.17)
for x in [-.44,.44]:
    orb('Little round ear',(x,-.32,1.61),(.19,.13,.22),terra)
    orb('Ear inner',(x,-.427,1.64),(.10,.035,.13),cream)
    orb('Sleepy eye',(x,-1.365,1.29),(.10,.045,.072),eye)
    box('Heavy eyelid',(x,-1.391,1.34),(.118,.04,.045),peach,.032)
    orb('Eye glimmer',(x-.024,-1.405,1.286),(.018,.011,.017),ivory)
for x in [-.26,.26]: orb('Snout nostril',(x,-1.456,.94),(.062,.025,.043),dark)
line('Deadpan mouth',[(-.24,-1.472,.74),(0,-1.483,.72),(.24,-1.472,.74)],terra,.016)

# Toucan: substantial belly and small feet, folded wings and a lightweight-looking wedge beak.
root('TOUCAN | inquisitive acrobat',(3.35,0,.24),-.42)
for x in [-.32,.32]: box('Broad resting foot',(x,-.10,.17),(.25,.40,.14),orange,.08)
box('Compact indigo body',(0,.12,.84),(.63,.65,.65),indigo,.28)
orb('Cream bib',(0,-.507,1.02),(.48,.105,.53),cream)
box('Head',(0,-.03,1.62),(.58,.54,.45),indigo,.24)
for x in [-.535,.535]:
    orb('Cream eye patch',(x,-.31,1.74),(.073,.27,.24),cream)
    orb('Toucan eye',(x*1.10,-.385,1.77),(.066,.105,.105),eye)
    orb('Toucan glint',(x*1.17,-.426,1.814),(.019,.025,.025),ivory)
    o=box('Folded wing',(x*1.13,.22,.92),(.15,.51,.43),wingmat,.13); o.rotation_euler.x=-.25
    for z in [.68,.84]: line('Wing sculpted groove',[(x*1.38,.02,z+.11),(x*1.38,.48,z)],indigo,.018)
# Beak along forward -Y, with explicit plane silhouette and coral final section.
rings=[(-.44,.39,1.39,1.98),(-1.20,.34,1.42,2.02),(-1.69,.20,1.46,1.88),(-1.95,.035,1.49,1.61)]
verts=[]
for y,w,lo,hi in rings: verts.extend([(-w,y,lo),(w,y,lo),(w,y,hi),(-w,y,hi)])
faces=[(3,2,1,0)]
for j in range(3):
    for i in range(4): faces.append((j*4+i,j*4+(i+1)%4,(j+1)*4+(i+1)%4,(j+1)*4+i))
faces.append((12,13,14,15))
b=mesh('Oversized sculpted beak',verts,faces,orange,.08); b.data.materials.append(coral)
for p in b.data.polygons:
    if p.index>=9: p.material_index=1
for side in [-1,1]: line('Beak seam',[(side*.39,-.53,1.54),(side*.34,-1.17,1.54),(side*.20,-1.65,1.54),(side*.035,-1.91,1.54)],terra,.013)
box('Tucked tail',(0,.76,.49),(.32,.35,.13),wingmat,.08)

active_root=None
# Quiet gallery presentation and labels, no external font dependency.
for x in [-3.35,0,3.35]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=1.49,depth=.20,location=(x,0,.1)); o=bpy.context.object; finish(o,'Display plinth',base)
    b=o.modifiers.new('Plinth soft rim','BEVEL'); b.width=.075; b.segments=3; o.modifiers.new('Plinth normals','WEIGHTED_NORMAL')
box('Studio floor',(0,0,-.13),(200,200,.1),floor,.01)
def text(label,loc,size):
    c=bpy.data.curves.new(label,'FONT'); c.body=label; c.align_x='CENTER'; c.size=size; c.extrude=.0005
    o=bpy.data.objects.new(label,c); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=(math.radians(74),0,0); o.data.materials.append(ink)
text('M E N A G E R I E',(0,1.18,3.38),.34)
text('L I V I N G   S C U L P T U R E S   /   0 1',(0,1.14,2.97),.105)
for x,name,sub in [(-3.35,'TORTOISE','THE QUIET OPTIMIST'),(0,'CAPYBARA','COMPLETELY UNBOTHERED'),(3.35,'TOUCAN','THE CURIOUS ONE')]:
    text(name,(x,-1.80,.16),.19); text(sub,(x,-1.87,-.10),.080)
bpy.ops.object.camera_add(location=(.25,-15,8.0)); cam=bpy.context.object; cam.rotation_euler=(Vector((0,-.1,1.20))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=11.8; scene.camera=cam
for name,loc,power,size in [('Key',(-4,-5,8),1500,7),('Fill',(5,-1,6),1000,5),('Rim',(0,5,7),1800,5)]:
    bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Menagerie studio'); scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.75,.85,1); scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.render.engine='CYCLES'; scene.cycles.samples=48; scene.cycles.use_denoising=True
scene.render.resolution_x=1800; scene.render.resolution_y=1100; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'; scene.view_settings.exposure=-.65; scene.view_settings.look='AgX - Medium High Contrast'; scene.render.image_settings.file_format='PNG'
scene.render.filepath=ROOT+'/assets/previews/lineup-v01.png'
# Save only this new scene and its dependencies, not the user's previous project.
bpy.data.libraries.write(ROOT+'/assets/source/menagerie-lineup-v01.blend',{scene},fake_user=True,compress=True)
print('MENAGERIE_READY',len(scene.objects))
