# GitHub Pages pipeline spike

## Question

Can Menagerie's private repository publish a phone-friendly, fully static browser build through GitHub Actions and GitHub Pages?

## Scope

This is a disposable deployment probe, not production game code. It deliberately has no framework or dependencies.

## Verification target

- GitHub Actions deploy job succeeds from `main`.
- The public page returns HTTP 200 over HTTPS.
- The page contains the mobile viewport declaration and expected smoke text.
- An unknown route serves the custom 404 page.

The final evidence and verdict will be recorded after deployment.
