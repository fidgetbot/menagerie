import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3000);
const revision = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#9fd8ca">
    <title>Menagerie · Pipeline Test</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 24px; background: #eef3e9; color: #183638; font: 16px/1.45 system-ui, sans-serif; }
      main { width: min(100%, 420px); padding: 32px; border-radius: 28px; background: #fff; box-shadow: 0 20px 60px #315b4c22; text-align: center; }
      .animal { font-size: 64px; }
      h1 { margin: 8px 0; letter-spacing: .12em; font-size: 28px; }
      p { margin: 8px 0; }
      small { color: #557373; }
    </style>
  </head>
  <body>
    <main>
      <div class="animal" aria-hidden="true">🐢</div>
      <h1>MENAGERIE</h1>
      <p>Railway pipeline connected.</p>
      <small>Revision ${revision}</small>
    </main>
  </body>
</html>`;

createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ ok: true, service: "menagerie-pipeline-spike", revision }));
    return;
  }

  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(page);
}).listen(port, "0.0.0.0", () => {
  console.log(`Menagerie pipeline spike listening on ${port}`);
});
