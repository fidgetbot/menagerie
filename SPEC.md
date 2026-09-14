# Menagerie — Game Specification

## Status

First character-design study created in Blender: three editable sculptures, a lineup render with camera-aligned labels, and isolated close-ups of all three animals. Models use procedural geometry and simple material colors, not UV texture maps.

The playable handling experiment now uses seven exported animals—tortoise, capybara, toucan, red armadillo, dragonfly, ram, and lower-tail skunk—with Three.js and Rapier. A shuffled bag presents each species once per seven animals. The next animal is always visible above the stack in a uniformly randomized three-dimensional orientation; pressing takes control rather than spawning it. Drag direction chooses a camera-relative rotation axis, distance from the initial press controls angular speed through a nonlinear curve, returning near the press point stops rotation, and release preserves the exact visible orientation. Placement remains temporarily locked over the stack to isolate whether rotation steering is enjoyable. Each species has its own compound collider and mass distribution: a forgiving low tortoise, a longer capybara bridge, and an asymmetric toucan with a deliberately light beak. Dynamic bodies use continuous collision detection to limit deep corner penetration. On release, the animal descends from the generous rotation clearance as a non-colliding sensor until its real compound collider reaches the stack, then becomes dynamic from the preceding safe position; this prevents the full hover distance from becoming impact energy. Landing bodies temporarily use low contact friction and absorb their first support impulse so an edge cannot convert residual impact into a visible upward pole-vault. Scoring does not zero velocity, force sleep, or otherwise mutate physics; high stacking friction is restored only after Rapier naturally sleeps the body, avoiding delayed solver ejections from marginal contacts. The prototype also includes generous rotation clearance, automatic hover height, fixed orthographic tower tracking, settlement scoring, platform-contact fall detection, restart, and a game-over state styled as part of the open interface rather than a modal card, with the same airy typography and a quiet outlined Play again action. Settlement accumulates evidence of calm supported contact rather than requiring an uninterrupted low-velocity interval. A timer outside the animation loop independently resolves any overdue release, and the next animation frame is scheduled before physics/render work so a one-off engine exception cannot permanently stop the game. Any caught frame failure becomes game over rather than a frozen screen. Any released animal touching the platform ends the run, including one that previously scored and later falls from the stack. Decorative parts remain animation-only. A brief two-line goal appears above three short control instructions in the concept study typography; the whole tutorial fades after the first successful landing. Window-level pointer/touch completion, pointer cancellation, lost capture, page hiding, and window blur all finish an active release so mobile browser chrome cannot leave a stale pointer latched with an animal suspended. A production Vite build passes locally and mobile checks cover the visible species, rate control, interrupted-pointer recovery, bounded settlement, injected frame-failure recovery, failure presentation, and play-again reset without browser errors. An opt-in `?trace=1` flight recorder keeps a rolling minute of body transforms, velocities, lowering/support state, frame timing, pointer lifecycle, scoring, failures, and upward-anomaly markers. Its Share trace control uses the iOS share sheet when available and downloads JSON otherwise; traces persist across a reload within the tab so a failed run can still be recovered. The playable GitHub Pages build is checked over HTTPS after deployment, including its custom HTTP 404 response.

## Expansion studies 02 (not integrated into gameplay)

Six editable preliminary ceramic models are saved in `assets/source/menagerie-expansion-v01.blend`, with a review sheet at `assets/previews/expansion-v01.png` and reproducible Blender generator `scripts/build_expansion.py`. They retain the original soft-edged shapes, glossy eyes, and glazed material family, with distinct colors: oatmeal/ochre ram, mulberry pangolin, pistachio caterpillar, persimmon crab, blue-grey raccoon, and lagoon ray.

- Caterpillar and crab: easy foundations, with broad flattened upper surfaces.
- Ray: broad diamond wings; easy-to-moderate, with a raised central body and rear tail.
- Raccoon: moderate, with a broad back and asymmetric striped tail.
- Ram: moderate-to-hard, with a buildable saddle but protruding curled horns.
- Pangolin: hard, a curved segmented silhouette with overlapping sculpted scales.

These difficulty grades describe intended geometry, not measured physics balance. Models remain editable multi-part Blender objects; colliders, export optimization, and integration are deferred until design review. These six early studies were superseded by the approved expansion below.

## Historical four-candidate collision screening

The revised concept set is red armadillo, dragonfly, plain-fleece ram, and zebra. A provisional Rapier proxy study in `studies/stackability/README.md` records 2,048 structured orientation cases and a small combined tweak comparison. Results favor armadillo/dragonfly as foundations and flag ram/zebra as harder, especially as upright supports. These are manually estimated collision shapes, not final visual assets or production-state-machine validation. This screening preceded integration and is retained as historical evidence.

## Approved expansion integrated

Four new Blender-authored models join the original trio: red/coral armadillo with a flattened banded crown; teal dragonfly with four substantial celadon wings; oatmeal ram with plain fleece and faceted ochre spiral horns; charcoal-plum skunk with an ivory stripe and a broad tail lowered by 25% relative to its first proxy. Zebra is excluded. The starting tortoise remains fixed; the seven-species shuffled bag contains each species exactly once per cycle.

`src/expansion-colliders.json` contains the screened body-local compound shapes, including the reduced skunk tail. New visual exports retain the same origin as their colliders rather than shifting a tail/horn off its physical shape. Conservative origin-relative extents provide full rotation clearance. Eyes blink and feet animate cosmetically; wings, horns, armor, and tail remain rigid load-bearing geometry. Existing release lowering, natural-sleep scoring, interruption recovery, trace recording, tutorial, and silent audio state are preserved.

Source: `assets/source/menagerie-final-expansion.blend`; generator: `scripts/build_final_animals.py`; runtime: `public/models/{armadillo,dragonfly,ram,skunk}.glb`. These are real modeled interpretations of the approved concepts, not image textures or the rejected early expansion models. Difficulty remains provisional pending phone play. Integration validation: 61 mobile WebKit scenarios (49 ordered upright pairings plus 12 tilted/inverted releases), zero unresolved turns/page exceptions/upward anomalies, all restarts reset to zero. 41 upright pairings survived the ten-second post-resolution observation; eight naturally fell. The original tortoise/toucan incident orientations both scored and naturally slept without anomalies. See `studies/stackability/integration-results.json` and `npm run test:expansion`.

## Goal

A small, compelling single-player 3D browser game, optimized for phone touch controls, showcasing generated models, animation, sound effects, and music. Inspired by animal-shaped stacking pieces in Beasts of Balance, with original creatures and presentation.

## Core loop

1. Present one random animal at a time; no animal-selection menu.
2. Player steers the animal's rotation while it remains centered over the stack.
3. Releasing drops it in its current orientation.
4. After settling, award one point and present the next animal.
5. A released animal falling off the platform ends the run; show Game over and a Play again action.

No timer, combos, multiplayer, inventory, or progression systems for the first demo. Local best score is sufficient. Exact settling and fall thresholds will be tuned in the prototype.

## Handling

- One-finger press, drag, return, release. No rotation buttons or manipulation modes.
- Keep the next animal visible above the stack while awaiting input; pressing establishes the rate control's neutral point.
- Give every summoned animal an independent, uniformly randomized 3D starting orientation.
- Drag direction selects a camera-relative rotation axis; drag distance selects angular speed. A generous dead zone stops rotation near the initial press point, and a nonlinear response supports both precise adjustments and fast turns.
- Whole-body orientation is player-controlled. Character personality remains in cosmetic, non-load-bearing animation.
- Capture the visible orientation exactly on release and begin with zero angular momentum.
- Automatic height keeps the held animal far enough above first contact to rotate freely around any axis without visually intersecting the stack.
- Keep the animal clear of the finger and centered over the stack during this isolated control experiment.
- Held animals cannot push the tower around. Released animals use physics.
- Reconsider horizontal/depth placement only after the rotation-control experiment establishes whether lateral positioning can add a meaningful second decision.

## Camera

Fixed front-facing angle with slight downward pitch and fixed zoom. Prefer orthographic projection. Follow the placed tower's top upward smoothly; lower sections leave the frame. No orbit or zoom controls. Keep room above the tower for the held animal, use a tracking dead zone, and avoid camera movement during precise placement.

## Initial animals

All three should be reasonably easy to stack, similarly sized, with broad useful contact surfaces and recognizable silhouettes in different orientations.

- **Tortoise — easy:** low, broad foundation; gently flattened shell top and broad underside. Slow squirm, head peeks and paddling feet. Jade skin, turquoise polygonal shell plates, golden seams.
- **Capybara — medium:** chunky rounded rectangle, broad back, tucked legs and squared snout. Longer/taller than tortoise; useful for bridging and overhangs. Deadpan expression. Terracotta, peach, cream muzzle.
- **Toucan — harder:** compact body, folded wings, broad resting belly, oversized beak. Interesting asymmetry without an unfairly heavy beak. Curious and fidgety. Indigo body, cream chest, mango-orange beak with coral tip.

## Art direction

Viva Piñata's color and playfulness crossed with bold angular animal silhouettes; no literal paper-craft finish. Broad deliberate facets, gently beveled edges, compact limbs and expressive eyes. Rich graphic color patches rather than noisy detail or realistic fur/feathers.

Living designer toys with ceramic richness and a soft touch:

- Satin ceramic-like surfaces, broad soft highlights and subtle close-up texture.
- Tortoise: slightly glossier shell and matte skin.
- Capybara: warm velvety matte, without fuzz.
- Toucan: satin body and glossier beak.
- Glossy dark eyes with clear catchlights throughout.

Soft warm lighting, strong readable contact shadows, restrained sky/water backdrop and quiet UI. Landings feel substantial but soft, not brittle.

## Life and animation

Held animals blink, look toward landing spots, move non-supporting parts and squirm. Landings prompt surprise, subtle squash and relief. Stacked animals look at incoming neighbors and react to wobbling. Falling animals flail comically. Cosmetic animation must not arbitrarily change load-bearing collision surfaces or destroy a stable stack.

## Technology and assets

- TypeScript + Vite for the browser application.
- Three.js for rendering, materials, animation and camera.
- Rapier for fixed-timestep physics and headless Node shape simulations, sharing parameters with gameplay.
- Blender source models and animation exported to GLB; simple compound collision shapes closely follow visible geometry.
- Stable Audio 3 for generated creature sounds, impacts, wobble cues and music; audition, edit and document generated assets. Unlock Web Audio on first touch.
- GitHub Actions deploys the static build to GitHub Pages; game simulation runs entirely on the player's device.
- Optimize mesh complexity, textures, shadows and draw calls for real phones. Performance targets must be measured before claiming readiness.

## Shape validation

Test all 49 ordered species pairings across the seven-species cast, including observation after scoring. Vary placement position, orientation and drop height. Measure settlement success, slipping, tipping and mixed-tower sensitivity. Tune geometry, friction and center of mass while preserving visual/physical agreement. Test rate-control precision across useful orientations and screen sizes. Simulations guide tuning; actual phone playtests determine feel.

## Milestones

1. Playable touch/physics experiment: three study animals, rate-controlled rotation/release, fixed tracking camera, score, game over and restart. **Implemented; phone feel still needs human playtesting.**
2. Shared headless simulation harness and further shape tuning across all three colliders.
3. Three-animal art lineup at gameplay scale plus close-ups; refine the visual direction. **First study complete.**
4. Optimized generated models, expressive animation, generated audio and polish.
5. Phone testing and GitHub Pages deployment; verify the live playable build.

## Repository practice

Keep this specification synchronized with material implementation changes. Keep credentials, build output, caches and temporary renders out of Git. Decide on Git LFS or separate storage before committing large source assets. Record asset provenance and generation settings alongside final assets.

### Skunk replacement screening

Skunk replaces zebra in the proposed concept set (not gameplay). `studies/stackability/skunk-sweep.mjs` and `skunk-results.json` record 896 proxy cases. The broad-tail baseline achieved 140/256 incoming stable and 161/224 as upright support; a 25% lower tail achieved 180/256 and 183/224. Explore the lower tail while retaining its width/curl and small head. Geometry and density remain provisional; final models require validation.

### Reference-led Blender rebuild (review stage)

Following visual review of the seven-animal integration, the four new models are being rebuilt against the approved concept illustrations. `scripts/build_reference_animals.py` authors separate editable Blender sculptures in `assets/source/menagerie-reference-rebuild.blend`; actual geometry renders are in `assets/previews/reference-models/`. This pass separates visual modeling from the provisional physics proxies. It is an art-review artifact, not a runtime replacement: the deployed GLBs, colliders, controls and silent audio state are unchanged. Any eventual game exports need fresh visual/collider alignment and mobile checks.

### Rebuilt asset validation branch

`review/reference-assets-validation` exports the reviewed Blender source using `scripts/export_reference_animals.py`. Visual meshes and convex collision pieces share one transform; horns and the skunk tail use multiple hull sections to retain their concavity. The dragonfly and skunk use uniform scale 0.72, versus 0.9 for armadillo/ram, to fit the existing fixed phone camera without changing proportions. The original three models and colliders, scoring/sleep logic, controls, and silent audio state are unchanged. Validation evidence and browser screenshots live in `studies/stackability/reference-validation/`. This review branch is not deployed.

Validation outcome: 69 baseline browser scenarios completed; one reproducible upward-anomaly case (toucan landing on dragonfly) prevents a clean release. The candidate remains on the review branch; exploratory mass/friction tweaks were rejected and reverted. See the validation README and replay trace for the unresolved contact behavior.

### Dragonfly deferred

The playable roster is tortoise, capybara, toucan, rebuilt armadillo, rebuilt ram and rebuilt lower-tail skunk. Dragonfly is excluded from loading and random selection while its collision issue is deferred; source/export assets are retained for future work. The blocked dragonfly/toucan interaction is therefore not reachable in gameplay.

Six-species release deployed to GitHub Pages at `ad0c70e`. The rebuilt armadillo, ram and skunk replace the earlier approximations; dragonfly remains excluded from model loading and random selection. The six-species production smoke passed locally, and the deployed JS and three replacement GLBs match the tested artifacts.

### Inertial roller control experiment

Drag displacement now rotates the animal directly in camera-relative axes. Release keeps it held, with bounded flick momentum decaying exponentially; touch catches it immediately. A dedicated bottom-center Drop button commits the visible orientation and clears rotational momentum. It is disabled during settling. Cancellation, blur and hidden-page events stop motion without dropping. Camera, placement, six-species roster and physics remain unchanged. No double-tap action or continuous autonomous held-body rotation.

### UI simplification and skunk sizing

Removed gesture tutorial copy; retained the two-line stacking objective and functional Drop button. Skunk uniform export/collider scale increased from 0.72 to 0.9, matching armadillo and ram, without changing its proportions. The objective retains its existing first-score fade behavior.

Rescaled skunk: all 16 affected pairing/tilt scenarios resolved without upward-anomaly markers or page errors; all restarts reset. Checked portrait framing at 390 × 714.

### Initial rotation invitation

On page load only, the first incoming animal receives a pronounced diagonal flick (4.4 rad/s initial speed, existing exponential damping). Touch or Drop catches it immediately. Subsequent pieces and ordinary restarts stay still; reduced-motion preference skips this decorative cue. No extra instruction text is added.

### Falling-animal ending camera

Only the newest released animal can trigger fall tracking, after 350 ms continuously descending unsupported below the stack top. A confirmed follow stays locked; it never switches to an older animal or oscillates back to tower tracking. Normal tower tracking only rises. On loss, hold 350 ms before easing to platform framing with the same 2.7 damping and fixed zoom/angle, then reveal Game over (maximum 3.2-second delay). Restart clears all camera state; engine faults show recovery immediately. Physics and scoring rules are unchanged.
