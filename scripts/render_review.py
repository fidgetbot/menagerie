"""Reframe review labels and render isolated character portraits in Blender."""
import bpy, sys
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=bpy.data.scenes['Menagerie • Character studies 01']; bpy.context.window.scene=s
cam=s.camera
# Place type parallel to the camera plane, independent of platform perspective.
q=cam.rotation_euler.to_quaternion()
labels=[('TORTOISE',-3.35,'THE QUIET OPTIMIST'),('CAPYBARA',0,'COMPLETELY UNBOTHERED'),('TOUCAN',3.35,'THE CURIOUS ONE')]
for name,x,subtitle in labels:
    for body,y,size in [(name,-2.60,.20),(subtitle,-2.90,.085)]:
        o=next(o for o in s.objects if o.type=='FONT' and o.data.body==body)
        o.location=cam.location+q@Vector((x,y,-8))
        o.rotation_euler=cam.rotation_euler
        o.data.align_x='CENTER'; o.data.align_y='CENTER'; o.data.size=size
        o.hide_render=False
s.render.filepath=str(root/'assets/previews/lineup-v01.png')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets/source/menagerie-lineup-v01.blend'))
bpy.ops.render.render(write_still=True)
if '--overview-only' in sys.argv: sys.exit(0)
# Isolate each animal with its own plinth; retain identical lighting/materials.
roots=[o for o in s.objects if o.type=='EMPTY']
for name,x,_ in labels:
    for o in s.objects:
        if o.type=='FONT': o.hide_render=True
        if o.parent in roots: o.hide_render=not o.parent.name.startswith(name)
        if o.name.startswith('Display plinth'): o.hide_render=abs(o.location.x-x)>.1
    cam.location=(x+2.8,-7.6,4.8)
    cam.rotation_euler=(Vector((x,-.15,1.20))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.ortho_scale=3.75
    s.render.resolution_x=1200; s.render.resolution_y=1200
    s.render.filepath=str(root/('assets/previews/'+name.lower()+'-detail-v01.png'))
    bpy.ops.render.render(write_still=True)
