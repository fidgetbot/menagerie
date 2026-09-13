"""Export the tortoise study as a self-contained GLB for the browser prototype."""

import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "models" / "tortoise.glb"

scene = bpy.data.scenes["Menagerie • Character studies 01"]
bpy.context.window.scene = scene
root = bpy.data.objects["TORTOISE | quiet optimist"]

original_location = root.location.copy()
original_rotation = root.rotation_euler.copy()

try:
    root.location = (0, 0, 0)
    root.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in root.children_recursive:
        obj.select_set(True)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )
    print(f"Exported {OUTPUT}")
finally:
    root.location = original_location
    root.rotation_euler = original_rotation
