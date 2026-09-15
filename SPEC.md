# Menagerie — Current Specification

## Product

A single-player, phone-first 3D browser game about stacking ceramic animal sculptures. The game runs client-side with TypeScript, Vite, Three.js, and Rapier, and is deployed to GitHub Pages. Audio is silent. No accounts, timer, multiplayer, progression, or animal-selection menu.

## Roster and loop

The active roster is tortoise, capybara, toucan, armadillo, ram, and skunk. Only these six models are loaded and offered. Each shuffled bag contains each species once. A fixed tortoise anchors the stack; one incoming animal waits above it in a randomized orientation. A supported, settled placement earns one point. Any released animal reaching the platform or leaving the allowed bounds ends the run, including animals that scored earlier.

## Controls and interface

One continuous rounded-sphere mapping handles every single-pointer drag. Central drags tumble the animal; curved drags toward and beyond the sphere's shoulder progressively become twist about the viewing direction. A cubic shoulder removes a hard mode boundary. Rotation is anchored to the pointer-down orientation, so returning to the start undoes the drag and event sampling does not alter the result. The initial pose establishes one physical/control pivot that remains fixed for the entire held phase, including inertial spin. No rotation-driven height correction occurs; the sensor-only lowering path resolves actual clearance after the bubble pops while preserving collider alignment. Each model's full body radius sizes its bubble independently of hover height. Gentle flick momentum is capped at 0.675 rad/s and decays exponentially at rate 5/s; beginning another drag catches it immediately. Position and height are automatic between pieces. A quick stationary tap inside the bubble pops it, clears rotational momentum, and commits the visible orientation after a brief 145 ms visual transition; movement beyond 10 CSS pixels, a press longer than 280 ms, cancellation, blur, or page hiding never places a piece. The bottom control is hidden during play and appears as Play again immediately on loss. Play again resets the run, score, controls, and camera. There is no dedicated Drop button, top-right restart control, or Game over overlay.

The default presentation treats the control surface as a playful soap bubble that remains visible for the entire held phase. Broad asymmetric reflections, a lightly tinted interior, a lower caustic, and very slow breathing/shimmer animation suggest a transparent volume without moving the animal or its pivot. Active dragging slightly strengthens the bubble; placement briefly expands and fades it like a pop before the animal begins sensor-only lowering. `?bubble=0` hides the visual for diagnostic comparison; `?bubble=1` explicitly enables it. Bubble visibility never changes input mapping. There is no gesture tutorial text or XYZ axis labeling. The initial two-line stacking goal fades after the first score. On page load only, the first animal receives a 4.4 rad/s diagonal flick using ordinary damping; reduced-motion preference skips this cue and removes idle bubble animation. Ordinary replay and subsequent animals receive no opening flick. Cancellation, blur, and page hiding stop rotation without placing a piece.

## Camera

Fixed orthographic zoom and viewing angle. Normal camera tracking rises with the placed tower. Only the newest released animal can trigger fall tracking, after 350 ms continuously descending unsupported below the stack top. A confirmed follow stays locked. Downward movement is capped at 2 world units/s and acceleration at 2.5 world units/s², with a slower approach near the target. On loss the camera eases to platform framing without interrupting an existing descent. There is no completion deadline; Play again is available throughout. Replay clears the follow target, timers, and camera velocity.

## Physics

Held pieces do not affect the stack. Placement lowers the sensor-only body to contact before enabling dynamics, preserving the selected orientation. Compound colliders share the visible model's local transform. Rebuilt armadillo, ram, and skunk use geometry-derived convex sections; the skunk's model and colliders share uniform scale 0.9.

Use a fixed timestep and continuous collision detection. Landing friction and first-contact damping limit rebounds. Scoring is bookkeeping-only: never force sleep or zero velocities on scoring. Restore stacking friction only after natural Rapier sleep. Settlement accumulates evidence of calm supported contact. Release deadlines and watchdogs prevent unresolved turns; caught engine faults enable replay through a reload.

## Visuals and assets

Broad softened planes, rich ceramic colors, glossy dark eyes, restrained sculpted detail, warm lighting, and readable shadows. Cosmetic blinking, limb animation, and a landing pulse do not alter load-bearing colliders. Original trio: `assets/source/menagerie-lineup-v01.blend`. Armadillo, ram, and skunk: `assets/source/menagerie-reference-rebuild.blend`. Runtime models: `public/models/`.

## Audio development

The shipped game remains silent while a generated contact bank is auditioned. `audio/sfx-bank.json` currently defines a focused Stable Audio 3 Small SFX material prototype: short bright settling ticks and clear hollow body clinks. Stronger collisions and platform impacts will be generated only after that core ceramic character is approved. `npm run audio:generate` preserves raw stereo generations outside the repository, creates short mono 44.1 kHz PCM audition copies at a consistent peak level, validates their technical properties, and records model, prompt, seed, processing, and licensing provenance. Generated files are exploratory until explicitly selected by ear against gameplay. Runtime integration must use measured Rapier contact strength to select and modulate approved samples; it must not encode a canned settling sequence.

## Validation and delivery

Build with `npm run build`. Browser checks cover all 36 ordered active-species pairs plus tilted placements, ten-second post-resolution observation, input gestures, replay, and failure recovery. Rotation checks exercise the rounded tumble-to-roll transition, pivot stability, drag-back undo, momentum catching, quick-tap popping, rejection of holds/cancellations, and identical results with and without the bubble visual on phone and desktop. Natural falls are valid outcomes; unresolved turns, exceptions, and upward anomalies fail regression checks. Phone feel still requires human playtesting.

An opt-in `?trace=1` recorder captures transforms, velocities, support state, input, scoring, failures, and camera events. Share trace exports JSON; recording survives reload within the tab. GitHub Actions deploys the static build to Pages. Verify the deployed artifact after gameplay changes. Keep build output, credentials, caches, and temporary test artifacts out of Git.
