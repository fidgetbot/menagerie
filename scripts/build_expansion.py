"""Six editable ceramic stacking studies. Blender background; no game changes."""
from pathlib import Path
exec(Path(__file__).with_name('build_lineup.py').read_text().split('# Tortoise:')[0])
scene.name='Menagerie • Character studies 02'
cream2=mat('ram oatmeal',(.78,.66,.43),.32)
sage=mat('caterpillar pistachio',(.40,.57,.17),.30)
red=mat('crab persimmon',(.78,.19,.095),.29)
plum=mat('pangolin mulberry',(.29,.12,.24),.30)
plumlight=mat('pangolin rose scales',(.48,.25,.33),.32)
slate=mat('raccoon blue grey',(.19,.30,.34),.32)
raymat=mat('ray lagoon',(.075,.43,.52),.28)
roots=[]
def start(name):
    r=root(name,(0,0,.14),-.25); roots.append(r); return r

def eyes(y,z,spread=.3):
    for x in [-spread,spread]:
        orb('Glossy eye',(x,y,z),(.075,.055,.083),eye)
        orb('Eye glint',(x-.022,y-.045,z+.027),(.019,.013,.022),ivory)
def feet(xs,ys,m,z=.2):
    for x in xs:
        for y in ys: box('Stout foot',(x,y,z),(.22,.26,.18),m,.10)

start('RAM')
box('Broad wool saddle',(0,.18,.86),(.72,.91,.53),cream2,.26)
# Shallow wool marks keep the back buildable.
for x in [-.6,.6]:
    for y in [-.2,.2,.6]: orb('Wool curl',(x,y,1.01),(.16,.21,.2),ivory)
feet([-.46,.46],[-.45,.72],terra)
box('Ram face',(0,-.77,1.05),(.4,.4,.44),peach,.20)
box('Muzzle',(0,-1.10,.85),(.34,.19,.19),cream,.12)
eyes(-1.13,1.18,.22)
for side in [-1,1]:
    coords=[]
    for i in range(45):
        t=i/44*math.pi*1.8; rad=.46*(1-.68*i/44)
        coords.append((side*.57,-.63+rad*math.sin(t),1.28+rad*math.cos(t)))
    line('Thick curled horn',coords,gold,.14)
orb('Tucked tail',(0,1.02,.87),(.18,.26,.22),cream2)

start('PANGOLIN')
# A crescent in the YZ plane, tapered around an open inner cradle.
for i in range(13):
    a=math.radians(-115+i*22); y=.74*math.cos(a); z=1.02+.74*math.sin(a)
    r=.36 if i<9 else .36-(i-9)*.045
    orb('Curled body segment',(0,y,z),(.50 if i<9 else .50-(i-9)*.065,r,r),plum,24,12)
    if i<10:
        for j in range(5):
            phi=(j-2)*.51
            x=.46*math.sin(phi); out=.31*math.cos(phi)
            o=orb('Overlapping ceramic scale',(x,y+out*math.cos(a),z+out*math.sin(a)),(.18,.20,.095),plumlight,12,6)
            o.rotation_euler.x=a-math.pi/2
box('Little tapered face',(0,-.57,.44),(.31,.33,.21),peach,.17)
orb('Snout',(0,-.87,.40),(.19,.22,.14),cream)
eyes(-.80,.54,.22)
feet([-.39,.39],[-.29],plum,z=.18)

start('CATERPILLAR')
for i,y in enumerate([-.84,-.28,.28,.84]):
    box('Flat topped cushion segment',(0,y,.58),(.55,.34,.36),sage,.24)
    for x in [-.43,.43]: orb('Tiny foot',(x,y,.17),(.20,.20,.15),gold)
box('Friendly raised head',(0,-1.10,.80),(.48,.36,.39),mint,.25)
eyes(-1.437,.91,.25)
line('Smile',[(-.14,-1.46,.68),(0,-1.48,.64),(.14,-1.46,.68)],jade,.015)
for x in [-.25,.25]:
    line('Stubby antenna',[(x,-1.03,1.1),(x*1.16,-1.02,1.35)],jade,.065)
    orb('Antenna tip',(x*1.16,-1.02,1.35),(.10,.10,.10),gold)

start('CRAB')
box('Broad flat carapace',(0,0,.57),(.87,.62,.30),red,.23)
box('Warm shell crown',(0,.06,.81),(.67,.45,.08),peach,.08)
for side in [-1,1]:
    for y in [-.3,.10,.47]:
        line('Thick tucked leg',[(side*.65,y,.45),(side*1.08,y-.08,.27),(side*1.15,y-.22,.16)],red,.12)
    line('Claw arm',[(side*.66,-.35,.5),(side*1.04,-.65,.58)],red,.16)
    orb('Claw palm',(side*1.12,-.78,.65),(.30,.29,.25),peach)
    for dx in [-.14,.14]:
        orb('Rounded pincer',(side*1.12+dx,-1.02,.70),(.105,.22,.16),red)
for x in [-.31,.31]:
    orb('Eye mount',(x,-.56,.86),(.13,.12,.16),red)
eyes(-.667,.93,.31)
line('Small smile',[(-.17,-.636,.53),(0,-.658,.50),(.17,-.636,.53)],terra,.017)

start('RACCOON')
box('Squat rounded body',(0,.18,.75),(.65,.74,.52),slate,.26)
feet([-.43,.43],[-.38,.64],indigo)
box('Broad masked head',(0,-.60,1.03),(.58,.42,.42),slate,.23)
for x in [-.39,.39]:
    orb('Round pointed ear',(x,-.39,1.46),(.19,.14,.22),indigo)
    orb('Ear inset',(x,-.50,1.47),(.105,.045,.13),cream2)
    o=orb('Eye mask',(x*.68,-.981,1.12),(.235,.057,.145),indigo); o.rotation_euler.y=x*.3
box('Cream muzzle',(0,-1.01,.87),(.29,.19,.20),cream2,.14)
orb('Black nose',(0,-1.2,.97),(.11,.07,.08),eye)
eyes(-1.035,1.14,.27)
# Curled tail stays thick and acts as a rear counterweight.
for i in range(9):
    t=i/8; orb('Striped tail',( .34+.36*math.sin(t*2.5),.73+.65*t,.48+.10*math.sin(t*3)),(.25,.19,.21),indigo if i%2 else slate)

start('RAY')
# A beveled broad diamond: deliberately flat upper wing surfaces.
verts=[(-1.35,0,.36),(-.55,-.79,.36),(.55,-.79,.36),(1.35,0,.36),(.38,.80,.36),(-.38,.80,.36)]
verts += [(x,y,z+.19) for x,y,z in verts]
faces=[tuple(range(5,-1,-1)),tuple(range(6,12))]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]
mesh('Broad wing platform',verts,faces,raymat,.15)
box('Central body',(0,-.1,.59),(.43,.65,.17),raymat,.16)
line('Thick curled tail',[(0,.54,.42),(0,1.01,.34),(.23,1.30,.31),(.53,1.34,.34),(.70,1.15,.4)],raymat,.12)
for x in [-.26,.26]: orb('Raised eye ridge',(x,-.46,.72),(.14,.22,.13),raymat)
eyes(-.643,.77,.26)
line('Gentle mouth',[(-.18,-.799,.45),(0,-.815,.42),(.18,-.799,.45)],indigo,.016)

# Cap ceramic tube ends; none should look like open pipes.
for o in scene.objects:
    if o.type=='CURVE': o.data.use_fill_caps=True
roots[0].rotation_euler.z=-.55
roots[1].rotation_euler.z=-1.05
# Arrange in two rows; labels sit in the camera plane for consistent readability.
active_root=None
for i,r in enumerate(roots):
    r.location=( (i%3-1)*3.9, (1-i//3)*4.7, .14)
box('Studio floor',(0,0,-.12),(200,200,.1),floor,.01)
bpy.ops.object.camera_add(location=(0,-15,15)); cam=bpy.context.object
cam.rotation_euler=(Vector((0,2.25,.55))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=12.4; scene.camera=cam
for name,loc,power,size in [('Key',(-4,-5,10),1800,7),('Fill',(5,0,8),1100,5),('Rim',(0,8,9),1900,5)]:
    bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; o.rotation_euler=(Vector((0,2,.7))-o.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Expansion studio'); scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.75,.85,1); scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
q=cam.rotation_euler.to_quaternion()
def label(body,x,y,size):
    c=bpy.data.curves.new(body,'FONT'); c.body=body; c.align_x='CENTER'; c.align_y='CENTER'; c.size=size
    o=bpy.data.objects.new(body,c); scene.collection.objects.link(o); o.location=cam.location+q@Vector((x,y,-10)); o.rotation_euler=cam.rotation_euler; c.materials.append(ink)
label('M E N A G E R I E  /  0 2',0,4.25,.27)
label('CERAMIC SHAPE STUDIES',0,3.85,.115)
subs=['RAM / MODERATE-HARD','PANGOLIN / HARD','CATERPILLAR / EASY','CRAB / EASY','RACCOON / MODERATE','RAY / EASY-MODERATE']
for i,s in enumerate(subs): label(s,(i%3-1)*3.9, .13 if i<3 else -3.38,.15)
scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
scene.render.resolution_x=1800; scene.render.resolution_y=1500; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'; scene.view_settings.exposure=-.65; scene.view_settings.look='AgX - Medium High Contrast'; scene.render.image_settings.file_format='PNG'
bpy.data.libraries.write(ROOT+'/assets/source/menagerie-expansion-v01.blend',{scene},fake_user=True,compress=True)
scene.render.filepath=ROOT+'/assets/previews/expansion-v01.png'
bpy.ops.render.render(write_still=True)
print('SIX_STUDIES_COMPLETE',len(scene.objects))
