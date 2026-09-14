# Menagerie — Current Specification

## Product

A single-player, phone-first 3D browser game about stacking ceramic animal sculptures. The game runs client-side with TypeScript, Vite, Three.js, and Rapier, and is deployed to GitHub Pages. Audio is silent. No accounts, timer, multiplayer, progression, or animal-selection menu.

## Roster and loop

The active roster is tortoise, capybara, toucan, armadillo, ram, and skunk. Only these six models are loaded and offered. Each shuffled bag contains each species once. A fixed tortoise anchors the stack; one incoming animal waits above it in a randomized orientation. A supported, settled placement earns one point. Any released animal reaching the platform or leaving the allowed bounds ends the run, including animals that scored earlier.

## Controls and interface

A thin muted-teal ring with two small directional arrows surrounds the waiting animal. Its 44-pixel-wide invisible rim target selects twist about the viewing direction; starting inside selects sphere-based tumble. The selected gesture and guide position remain fixed until pointer release. Rotation is anchored to the pointer-down orientation, so returning to the start undoes the drag. Touches outside catch the animal without rotating it. Gentle flick momentum is capped at 1.625 rad/s and decays exponentially at rate 5/s; touching catches it immediately. The rim brightens during twisting, and the guide disappears on Drop. Finger release never drops it. Position and height are automatic. The bottom Drop button commits the visible orientation with zero rotational momentum, disables while settling, and becomes Play again immediately on loss. Play again resets the run, score, controls, and camera. There is no top-right restart control or Game over overlay.

The initial two-line stacking goal fades after the first score. There is no gesture tutorial text or XYZ axis labeling. On page load only, the first animal receives a 4.4 rad/s diagonal flick using ordinary damping; reduced-motion preference skips this cue. Ordinary replay and subsequent animals receive no opening flick. Cancellation, blur, and page hiding stop rotation without placing a piece.

## Camera

Fixed orthographic zoom and viewing angle. Normal camera tracking rises with the placed tower. Only the newest released animal can trigger fall tracking, after 350 ms continuously descending unsupported below the stack top. A confirmed follow stays locked. Downward movement is capped at 2 world units/s and acceleration at 2.5 world units/s², with a slower approach near the target. On loss the camera eases to platform framing without interrupting an existing descent. There is no completion deadline; Play again is available throughout. Replay clears the follow target, timers, and camera velocity.

## Physics

Held pieces do not affect the stack. Placement lowers the sensor-only body to contact before enabling dynamics, preserving the selected orientation. Compound colliders share the visible model's local transform. Rebuilt armadillo, ram, and skunk use geometry-derived convex sections; the skunk's model and colliders share uniform scale 0.9.

Use a fixed timestep and continuous collision detection. Landing friction and first-contact damping limit rebounds. Scoring is bookkeeping-only: never force sleep or zero velocities on scoring. Restore stacking friction only after natural Rapier sleep. Settlement accumulates evidence of calm supported contact. Release deadlines and watchdogs prevent unresolved turns; caught engine faults enable replay through a reload.

## Visuals and assets

Broad softened planes, rich ceramic colors, glossy dark eyes, restrained sculpted detail, warm lighting, and readable shadows. Cosmetic blinking, limb animation, and a landing pulse do not alter load-bearing colliders. Original trio: `assets/source/menagerie-lineup-v01.blend`. Armadillo, ram, and skunk: `assets/source/menagerie-reference-rebuild.blend`. Runtime models: `public/models/`.

## Validation and delivery

Build with `npm run build`. Browser checks cover all 36 ordered active-species pairs plus tilted placements, ten-second post-resolution observation, input gestures, replay, and failure recovery. Natural falls are valid outcomes; unresolved turns, exceptions, and upward anomalies fail regression checks. Phone feel still requires human playtesting.

An opt-in `?trace=1` recorder captures transforms, velocities, support state, input, scoring, failures, and camera events. Share trace exports JSON; recording survives reload within the tab. GitHub Actions deploys the static build to Pages. Verify the deployed artifact after gameplay changes. Keep build output, credentials, caches, and temporary test artifacts out of Git.
