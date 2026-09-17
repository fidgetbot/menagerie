import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 4187;
const origin = `http://127.0.0.1:${port}`;
const appUrl = `${origin}/menagerie/`;
const server = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], {
  stdio: "ignore",
});

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(appUrl)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Production preview did not start");
}

async function imageSize(page, path) {
  return page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  }, path);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${appUrl}?audio=0`);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  const appleHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  assert.equal(new URL(manifestHref, appUrl).pathname, "/menagerie/manifest.webmanifest");
  assert.equal(new URL(appleHref, appUrl).pathname, "/menagerie/icons/apple-touch-icon.png");

  const response = await fetch(new URL(manifestHref, appUrl));
  assert.equal(response.ok, true);
  const manifest = await response.json();
  assert.equal(manifest.name, "Menagerie");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.background_color, "#dce8dd");
  assert.deepEqual(await imageSize(page, new URL(appleHref, appUrl).href), [180, 180]);

  const expected = new Map([
    ["icons/icon-192.png", [192, 192]],
    ["icons/icon-512.png", [512, 512]],
    ["icons/icon-maskable-512.png", [512, 512]],
  ]);
  for (const icon of manifest.icons) {
    assert.deepEqual(await imageSize(page, new URL(icon.src, response.url).href), expected.get(icon.src));
  }
  assert.equal(manifest.icons.find((icon) => icon.purpose === "maskable")?.src, "icons/icon-maskable-512.png");
  console.log("PWA manifest and all declared icon dimensions pass.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
