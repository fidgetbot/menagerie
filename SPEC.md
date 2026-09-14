# Menagerie — Game Specification

## Status

First character-design study created in Blender: three editable sculptures, a lineup render with camera-aligned labels, and isolated close-ups of all three animals. Models use procedural geometry and simple material colors, not UV texture maps.

The playable handling experiment now uses all three exported animals—tortoise, capybara, and toucan—with Three.js and Rapier. A shuffled bag presents each species once per three animals. The next animal is always visible above the stack in a uniformly randomized three-dimensional orientation; pressing takes control rather than spawning it. Drag direction chooses a camera-relative rotation axis, distance from the initial press controls angular speed through a nonlinear curve, returning near the press point stops rotation, and release preserves the exact visible orientation. Placement remains temporarily locked over the stack to isolate whether rotation steering is enjoyable. Each species has its own compound collider and mass distribution: a forgiving low tortoise, a longer capybara bridge, and an asymmetric toucan with a deliberately light beak. Dynamic bodies use continuous collision detection to limit deep corner penetration. On release, the animal descends from the generous rotation clearance as a non-colliding sensor until its real compound collider reaches the stack, then becomes dynamic from the preceding safe position; this prevents the full hover distance from becoming impact energy. Landing bodies temporarily use low contact friction and absorb their first support impulse so an edge cannot convert residual impact into a visible upward pole-vault. Scoring does not zero velocity, force sleep, or otherwise mutate physics; high stacking friction is restored only after Rapier naturally sleeps the body, avoiding delayed solver ejections from marginal contacts. The prototype also includes generous rotation clearance, automatic hover height, fixed orthographic tower tracking, settlement scoring, platform-contact fall detection, restart, and a game-over state styled as part of the open interface rather than a modal card, with the same airy typography and a quiet outlined Play again action. Settlement accumulates evidence of calm supported contact rather than requiring an uninterrupted low-velocity interval. A timer outside the animation loop independently resolves any overdue release, and the next animation frame is scheduled before physics/render work so a one-off engine exception cannot permanently stop the game. Any caught frame failure becomes game over rather than a frozen screen. Any released animal touching the platform ends the run, including one that previously scored and later falls from the stack. Decorative parts remain animation-only. A brief two-line goal appears above three short control instructions in the concept study typography; the whole tutorial fades after the first successful landing. Window-level pointer/touch completion, pointer cancellation, lost capture, page hiding, and window blur all finish an active release so mobile browser chrome cannot leave a stale pointer latched with an animal suspended. A production Vite build passes locally and mobile checks cover all three visible species, rate control, interrupted-pointer recovery, bounded settlement, injected frame-failure recovery, failure presentation, and play-again reset without browser errors. An opt-in `?trace=1` flight recorder keeps a rolling minute of body transforms, velocities, lowering/support state, frame timing, pointer lifecycle, scoring, failures, and upward-anomaly markers. Its Share trace control uses the iOS share sheet when available and downloads JSON otherwise; traces persist across a reload within the tab so a failed run can still be recovered. The playable GitHub Pages build is checked over HTTPS after deployment, including its custom HTTP 404 response.

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

Before polishing models, test all nine ordered species pairings. Vary placement position, orientation and drop height. Measure settlement success, slipping, tipping and mixed-tower sensitivity. Tune geometry, friction and center of mass while preserving visual/physical agreement. Test rate-control precision across useful orientations and screen sizes. Simulations guide tuning; actual phone playtests determine feel.

## Milestones

1. Playable touch/physics experiment: three study animals, rate-controlled rotation/release, fixed tracking camera, score, game over and restart. **Implemented; phone feel still needs human playtesting.**
2. Shared headless simulation harness and further shape tuning across all three colliders.
3. Three-animal art lineup at gameplay scale plus close-ups; refine the visual direction. **First study complete.**
4. Optimized generated models, expressive animation, generated audio and polish.
5. Phone testing and GitHub Pages deployment; verify the live playable build.

## Repository practice

Keep this specification synchronized with material implementation changes. Keep credentials, build output, caches and temporary renders out of Git. Decide on Git LFS or separate storage before committing large source assets. Record asset provenance and generation settings alongside final assets.
