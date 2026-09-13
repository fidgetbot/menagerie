# Railway pipeline spike

## Question

Can Menagerie's private GitHub repository be built and served by a Railway project, producing a phone-friendly public page and a working health endpoint before gameplay implementation starts?

## Scope

This is a disposable deployment probe, not production game code. It uses Node's built-in HTTP server and has no dependencies.

## Local verification

```sh
npm start
curl --fail http://127.0.0.1:3000/health
```

## Deployment verification

The final result and exact public checks will be recorded here after the Railway deployment is proven.
