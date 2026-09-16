# Menagerie

**Rotate. Pop. Stack.**

A phone-first 3D animal-stacking game. Turn colorful ceramic creatures into a towering balancing act—one careful placement at a time.

**[Play Menagerie](https://fidgetbot.github.io/menagerie/)**

## How to play

- **Drag across the animal** to tumble it.
- **Sweep around it** to twist it clockwise or anticlockwise.
- **Flick** to spin it; begin another drag to stop and fine-tune.
- **Tap the bubble** to pop it and place the animal in its current orientation.
- Earn one point when it settles onto the stack. Keep stacking without letting a released animal reach the ground.
- When the run ends, a circular replay button appears.

Position and height are automatic, leaving you to find the right orientation. The waiting animal keeps a fixed manipulation pivot, including during a flick, so changing orientation does not make the piece bob above the stack. There is no timer. The camera follows the growing tower and eases down to a final view when the run ends.

## The animals

Six distinct shapes share softened edges, rich ceramic colors, and small animated details:

- **Tortoise:** a broad, tiled-shell foundation.
- **Capybara:** a chunky body and sleepy expression.
- **Toucan:** a compact body with an oversized, asymmetric beak.
- **Armadillo:** red armor bands and a flattened back.
- **Ram:** a smooth body and curled horns.
- **Skunk:** a small head and broad, striped tail.

Every run starts on a fixed tortoise. Incoming animals arrive in shuffled sets containing all six species, each with a random orientation. Blinks, small limb movements, and a landing pulse add life without moving the supporting collision shapes.

## Built for the browser

Menagerie runs entirely on your device, with no account or installation required. It supports touch and mouse input. Ceramic ticks and hollow clinks respond to actual animal contacts after the first touch unlocks browser audio.

- **Three.js** renders the scene and Blender-authored GLB models.
- **Rapier** simulates collisions and stacking at a fixed timestep.
- **TypeScript and Vite** build the application.
- **GitHub Actions and GitHub Pages** publish the static game.

## Development

Requires a current Node.js release and npm.

```sh
npm ci
npm run dev
```

Open the local `/menagerie/` URL printed by Vite.

```sh
npm run build    # Type-check and build into dist/
npm run preview  # Serve the production build locally
```

### Checks

With the development server running:

```sh
npx playwright install webkit
npm run test:expansion
npm run test:towers
```

The stacking harness checks the 36 ordered species pairings and nine tilted/inverted placements, observes each result for ten seconds, and checks for unresolved turns, browser errors, physics anomalies, and replay failures. Natural topples are valid outcomes. Results and screenshots are written to ignored `tmp/expansion-test/`.

The tower benchmark runs twelve reproducible upright ten-piece sequences with a short aiming interval between placements. It reports median score, eight-piece and ten-piece reach, anomalies, and browser errors to ignored `tmp/tower-test.json`; natural collapses remain valid outcomes. Set `TEST_FORGIVING=0` to compare the fixed-position/landing-friction baseline in development, and `TEST_STRICT_ANOMALIES=1` when upward markers should fail the command.

`TEST_URL` overrides the server URL. Deterministic species and orientation fixtures are available only in development builds. `scripts/test-rounded-arcball.mjs` checks continuous sphere tumbling and screen-axis roll, the rounded transition between them, drag-back undo, pivot stability, gentle momentum, hold-to-catch, tap-to-pop placement, bubble/no-bubble parity, and the opt-in surface-loop study on phone and desktop layouts.

Append `?trace=1` to enable the diagnostic flight recorder and Share trace action.

The translucent soap bubble remains around each waiting animal until it is popped. Append `?bubble=0` to hide it for diagnostic comparison; both variants use exactly the same control mapping and tap-to-place gesture.

Append `?loops=1` to try an experimental orientation aid. Once a touch moves beyond the tap threshold, three translucent great circles fade in on the bubble surface and turn with the animal. Quick taps and stationary holds never reveal them. The experiment is visual only and is disabled on the ordinary URL.

### Sound development

The playable game uses eight approved ceramic contact samples generated with Stable Audio 3 Small SFX. Rapier contact strength chooses and modulates them at runtime while pair-level onset tracking suppresses resting chatter. `npm run audio:generate` creates reproducible seeded candidates, preserves untouched raw generations, produces technically normalized audition copies, and records full provenance outside the repository. See [audio/README.md](audio/README.md). Append `?audio=0` to disable playback for diagnostics.

### Project layout

- `src/` — gameplay, rendering, physics, controls, and collision data.
- `public/models/` — browser-ready animal models.
- `assets/source/` — editable Blender files.
- `scripts/` — model generation, export, and browser checks.
- [SPEC.md](SPEC.md) — current behavior and implementation constraints.

The original trio is authored in [menagerie-lineup-v01.blend](assets/source/menagerie-lineup-v01.blend). Armadillo, ram, and skunk are authored in [menagerie-reference-rebuild.blend](assets/source/menagerie-reference-rebuild.blend).

## License

Menagerie's original code and project-owned assets are available under the [MIT License](LICENSE). Third-party libraries, tools, and their assets remain subject to their respective licenses.
