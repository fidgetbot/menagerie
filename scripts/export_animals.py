"""Export all three character studies as self-contained GLBs for the game."""

import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "models"
ANIMALS = {
    "tortoise": "TORTOISE | quiet optimist",
    "capybara": "CAPYBARA | completely unbothered",
    "toucan": "TOUCAN | inquisitive acrobat",
}

scene = bpy.data.scenes["Menagerie • Character studies 01"]
bpy.context.window.scene = scene
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

for slug, object_name in ANIMALS.items():
    root = bpy.data.objects[object_name]
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

        output = OUTPUT_DIR / f"{slug}.glb"
        bpy.ops.export_scene.gltf(
            filepath=str(output),
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_yup=True,
            export_materials="EXPORT",
        )
        print(f"Exported {output}")
    finally:
        root.location = original_location
        root.rotation_euler = original_rotation

