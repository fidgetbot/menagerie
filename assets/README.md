# First character study

Original procedural models authored with Blender Python and executed through Blender MCP. No downloaded models, reference images, external textures, or fonts. Material colors and geometry are editable independently. These are art-direction studies, not production-ready game assets.

- `source/menagerie-lineup-v01.blend`: standalone scene containing only Menagerie assets.
- `previews/lineup-v01.png`: three-animal studio lineup.
- `previews/tortoise-detail-v01.png`: shell and face close-up.

Blender 5.2.1 LTS; Cycles, 48 samples, denoising, AgX Medium High Contrast. Lineup 1800×1100; detail 1100×1100.

## Regeneration

Set `ROOT` in `scripts/build_lineup.py` to your checkout. Run it through Blender Python to build a new independent scene and write a scene library. Then run:

```sh
blender --background assets/source/menagerie-lineup-v01.blend --python scripts/finalize_lineup.py
```

Finalization saves a normal standalone Blender file and renders both images. The source file retains the lineup camera. Scripts preserve other open projects; no scene-clearing operation is used.

## Review boundaries

Still to validate: silhouettes at phone scale and inverted orientations, rig-friendly topology, exact stacking surfaces, collision shapes and physics. Capybara and toucan currently have a deliberately blocky construction; next art review should decide how much to soften or sculpt their profiles. No animation, UV mapping, or generated audio yet.
