import bpy
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=bpy.data.scenes['Menagerie • Character studies 01']; bpy.context.window.scene=s
for other in list(bpy.data.scenes):
    if other!=s: bpy.data.scenes.remove(other)
s.view_settings.exposure=-.65
s.view_settings.look='AgX - Medium High Contrast'
for o in s.objects:
    if o.name.startswith('Sleepy eye'): o.location.y=-1.365
    if o.name.startswith('Heavy eyelid'): o.location.y=-1.391
    if o.name.startswith('Eye glimmer'): o.location.y=-1.405
    if o.type=='FONT' and o.data.size==.080: o.hide_render=True
s.render.filepath=str(root/'assets/previews/lineup-v01.png')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets/source/menagerie-lineup-v01.blend'))
bpy.ops.render.render(write_still=True)
# A closer view for judging the soft-faceted shell and face.
s.camera.location=(-5.9,-7.5,5.0)
s.camera.rotation_euler=(Vector((-3.35,-.15,1.0))-s.camera.location).to_track_quat('-Z','Y').to_euler()
s.camera.data.ortho_scale=3.5
s.render.resolution_x=1100; s.render.resolution_y=1100
for o in s.objects:
    if o.type=='FONT': o.hide_render=True
s.render.filepath=str(root/'assets/previews/tortoise-detail-v01.png')
bpy.ops.render.render(write_still=True)
