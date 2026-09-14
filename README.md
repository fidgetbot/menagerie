# Menagerie

**Rotate. Drop. Stack.**

A phone-first 3D animal-stacking game. Turn colorful ceramic creatures into a towering balancing act—one careful placement at a time.

**[Play Menagerie](https://fidgetbot.github.io/menagerie/)**

## How to play

- **Drag inside the ring** to tumble the waiting animal.
- **Drag around the ring** to twist it clockwise or anticlockwise.
- **Flick** to spin it; touch again to stop and fine-tune.
- **Tap Drop** to place it in its current orientation.
- Earn one point when it settles onto the stack. Keep stacking without letting a released animal reach the ground.
- When the run ends, the same button becomes **Play again**.

Position and height are automatic, leaving you to find the right orientation. There is no timer. The camera follows the growing tower and eases down to a final view when the run ends.

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

Menagerie runs entirely on your device, with no account or installation required. It supports touch and mouse input and plays without sound.

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
```

The stacking harness checks the 36 ordered species pairings and nine tilted/inverted placements, observes each result for ten seconds, and checks for unresolved turns, browser errors, physics anomalies, and replay failures. Natural topples are valid outcomes. Results and screenshots are written to ignored `tmp/expansion-test/`.

`TEST_URL` overrides the server URL. Deterministic species and orientation fixtures are available only in development builds. `scripts/test-rotation-ring.mjs` checks direct twist, sphere tumbling, drag-back undo, gesture locking, guide stability, momentum, touch-to-stop, cancellation, and placement orientation on phone and desktop layouts.

Append `?trace=1` to enable the diagnostic flight recorder and Share trace action.

### Project layout

- `src/` — gameplay, rendering, physics, controls, and collision data.
- `public/models/` — browser-ready animal models.
- `assets/source/` — editable Blender files.
- `scripts/` — model generation, export, and browser checks.
- [SPEC.md](SPEC.md) — current behavior and implementation constraints.

The original trio is authored in [menagerie-lineup-v01.blend](assets/source/menagerie-lineup-v01.blend). Armadillo, ram, and skunk are authored in [menagerie-reference-rebuild.blend](assets/source/menagerie-reference-rebuild.blend).
