# GitHub Pages pipeline spike

## Question

Can Menagerie publish a phone-friendly, fully static browser build through GitHub Actions and GitHub Pages?

## Scope

This is a disposable deployment probe, not production game code. It deliberately has no framework or dependencies.

## Verification target

- GitHub Actions deploy job succeeds from `main`.
- The public page returns HTTP 200 over HTTPS.
- The page contains the mobile viewport declaration and expected smoke text.
- An unknown route serves the custom 404 page.

## Verdict: VALIDATED

The repository was made public because the current GitHub plan does not support Pages from private repositories. GitHub Pages was then configured with `build_type: workflow`.

Evidence from commit `88ee3b0`:

- GitHub Actions run `34743389501` completed successfully, including artifact upload and Pages deployment.
- `https://fidgetbot.github.io/menagerie/` returned HTTP 200 over HTTPS and contained the expected mobile viewport and smoke text.
- `/definitely-missing` returned HTTP 404 and served the expected custom not-found content.
- GitHub reports HTTPS enforcement enabled.

Recommendation: use this Pages workflow for the production Vite build. Replace the artifact path with Vite's `dist/` directory when the playable prototype is introduced, and configure Vite's base path as `/menagerie/`.
