# Rebuilt assets: validation pass

**Current status: six-species build released at `ad0c70e`; dragonfly deferred by user request. The six-species release excludes its loading/selection. The 51 applicable scenarios below are clean; the original seven-species findings are preserved for future dragonfly work.**

## Candidate

The GLBs are exports of `assets/source/menagerie-reference-rebuild.blend`, not newly approximated meshes. `scripts/export_reference_animals.py` uses the same transform for visuals and geometry-derived convex hulls. Curved horns and tail are sectional compounds; minor facial details remain cosmetic. All original-species colliders and scoring/sleep/friction logic are unchanged.

Dragonfly and skunk scale was reduced uniformly from 0.9 to 0.72 after phone-layout inspection found clipped wings and tutorial overlap. Armadillo/ram remain 0.9. Proportions and source geometry are unchanged.

## Results

- 49 ordered upright pairings plus 12 X-axis tilted cases and eight Y-axis cases: **69 scenarios**. Every turn resolved and every restart returned to zero. No page exceptions in this full baseline run.
- **68 scenarios had no upward-anomaly markers. One flagged:** upright dragonfly support, incoming toucan. The full sweep therefore exits nonzero; it is not represented as a clean pass.
- 39/49 upright stacks remained standing; the other ten fell. These are centered scripted placements, not player success rates.
- Four production-build drag/release scenarios resolved with no markers or page errors; all seven species appeared in selection and every restart reset.
- Five-armadillo tower scored five and remained standing through ten seconds of follow-up, without anomaly markers.
- Export bounding extents checked under 16 orientations per animal. Worst visual/collider discrepancy: armadillo 0.0405, dragonfly 0.000004, ram 0.0324, skunk 0.0382 game units. This verifies coordinate/bounds alignment, not exact equality of every concave contact surface. Cosmetic mouths/noses account for front-edge differences.
- Mobile-sized WebKit on this Mac: held-animal median frame interval 17 ms; p95 18 ms. This is not a physical iPhone performance measurement. Four GLBs total approximately 2.12 MB uncompressed; individual meshes range from 17,396 to 37,176 triangles.
- `npm run build` passes; the existing large physics-bundle warning remains.

## Reproducible blocker

`dragonfly-toucan-initial-trace.json` records the isolated replay. Dragonfly scores around 1.56 s and naturally sleeps at 1.57 s. Toucan releases at 1.65 s and reaches contact around 2.01 s. Both bodies are awake and rocking before the marker at 3.70 s (dragonfly upward velocity 1.04 m/s, reaching roughly 1.18 m/s in the adjacent sample). The stack falls at 4.21 s. This occurs during an actual collision, not a spontaneous scoring/sleep transition, but the release gate remains flagged pending contact-behavior refinement.

Two exploratory changes (more foot density, lower restored friction for dragonfly) did not clear the marker and were **reverted**. The candidate retains the full-sweep baseline settings. Do not merge/deploy it as regression-clean.

## Reproduce

```sh
npm run dev -- --host 127.0.0.1
npm run test:expansion
TEST_CROSS_AXIS=1 TEST_OUTPUT=../tmp/reference-crossaxis/ npm run test:expansion
TEST_PAIR=dragonfly,toucan TEST_OUTPUT=../tmp/reference-replay/ npm run test:expansion
node scripts/check-reference-export.mjs
node scripts/check-reference-browser.mjs
npm run build
npm run preview -- --host 127.0.0.1 --port 5175
node scripts/check-reference-production.mjs
```

Use `TEST_URL` to override the local server URL. The isolated replay writes its full trace. Physics harness diagnostics require the dev server; the production smoke intentionally uses actual random orientations and real input.

## Six-species release

Dragonfly has been removed from the selectable roster; its assets remain archived for future refinement. `six-species-results.json` selects the 36 unchanged non-dragonfly upright pairings plus 15 tilt cases from the completed sweep. All 51 resolved with no anomaly markers/page errors and clean resets. No collider or physics setting for these six species changed after that sweep. The production-input smoke was rerun with the reduced roster.
