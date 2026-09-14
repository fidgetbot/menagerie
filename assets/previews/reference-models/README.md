# Reference-led Blender review

These PNGs are Cycles renders of the editable geometry in `assets/source/menagerie-reference-rebuild.blend`, not image-generated illustrations. The approved concept references guide the proportions and material palette; these remain review models rather than a claim of exact reconstruction from a single view.

- Armadillo: shaped shoulder/rump shell, fitted armor bands, flatter crown, tapered head.
- Dragonfly: broad celadon wings with boolean-carved channels, segmented abdomen, paired eye lobes.
- Ram: plain fleece body, mauve muzzle, full tapering spiral horns.
- Skunk: tapered head, ivory surface stripe and broad lowered curl.

## Rebuild

Run Blender in a fresh background process:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build_reference_animals.py
```

Append `-- armadillo` (or another species) to render only that view. All four models are always authored and saved. In Blender, each animal has a named parent empty. The file opens showing the armadillo; toggle the parent and its descendants' viewport/render visibility to inspect another model. The script's `show()` function sets matching camera/framing and visibility automatically for each render.

No game assets or collider files are exported by this script. The live game is unchanged by this review pass.
