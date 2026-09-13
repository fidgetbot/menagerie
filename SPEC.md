# Menagerie — Game Specification

## Status

First character-design study created in Blender: three editable sculptures, a lineup render with camera-aligned labels, and isolated close-ups of all three animals. Models use procedural geometry and simple material colors, not UV texture maps.

The first playable handling experiment is implemented with the exported tortoise, Three.js, and Rapier. It includes relative one-finger positioning, smooth rotational squirming while held, exact-orientation release, automatic hover height, contact preview, fixed orthographic tower tracking, settlement scoring, falling detection, and restart. The tortoise collider uses broad load-bearing surfaces and a low, dense belly; decorative feet remain animation-only. The gameplay UI has no title or tagline. A production Vite build passes locally and the current mobile interaction check settles five consecutive centered releases, increments the score, and resets cleanly without browser errors. The playable GitHub Pages build has also passed the same mobile browser check over HTTPS, and its custom unknown-route response returns HTTP 404.

## Goal

A small, compelling single-player 3D browser game, optimized for phone touch controls, showcasing generated models, animation, sound effects, and music. Inspired by animal-shaped stacking pieces in Beasts of Balance, with original creatures and presentation.

## Core loop

1. Present one random animal at a time; no animal-selection menu.
2. Player holds and positions the animal while it squirms.
3. Releasing drops it in its current orientation.
4. After settling, award one point and present the next animal.
5. A released animal falling off the platform ends the run; one tap restarts.

No timer, combos, multiplayer, inventory, or progression systems for the first demo. Local best score is sufficient. Exact settling and fall thresholds will be tuned in the prototype.

## Handling

- One-finger hold, drag, release. No rotation buttons or manipulation modes.
- Smooth semi-random 3D rotational wandering while held: momentum, pauses, small turns and occasional larger rolls. Upside-down orientations are possible.
- Temperament varies by species, but useful release windows must occur regularly.
- Capture the visible orientation exactly on release; stop deliberate squirming. Start by removing most angular momentum, then tune through playtests.
- Automatic height keeps the held animal a short distance above first contact; a landing preview indicates contact, not guaranteed stability.
- Offset the animal from the finger for visibility, and use relative dragging to avoid jumps.
- Held animals cannot push the tower around. Released animals use physics.
- Prototype and validate the mapping of screen dragging to horizontal/depth placement; depth clarity remains an interaction risk.

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

Before polishing models, test all nine ordered species pairings. Vary placement position, orientation and drop height. Measure settlement success, slipping, tipping and mixed-tower sensitivity. Tune geometry, friction and center of mass while preserving visual/physical agreement. Test squirm release-window frequency and duration. Simulations guide tuning; actual phone playtests determine feel.

## Milestones

1. Playable touch/physics experiment: one finished-study tortoise, squirm/release, fixed tracking camera, score and restart. **Implemented; phone feel still needs human playtesting.**
2. Shared headless simulation harness and shape tuning; expand from the tortoise to all three colliders.
3. Three-animal art lineup at gameplay scale plus close-ups; refine the visual direction. **First study complete.**
4. Optimized generated models, expressive animation, generated audio and polish.
5. Phone testing and GitHub Pages deployment; verify the live playable build.

## Repository practice

Keep this specification synchronized with material implementation changes. Keep credentials, build output, caches and temporary renders out of Git. Decide on Git LFS or separate storage before committing large source assets. Record asset provenance and generation settings alongside final assets.
