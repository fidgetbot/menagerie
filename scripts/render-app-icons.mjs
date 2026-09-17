import { spawn, execFileSync } from "node:child_process";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "public", "icons");
const port = 4186;
const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  stdio: "ignore",
});

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/menagerie/scripts/icon-preview.html`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Icon preview server did not start");
}

async function render(page, variant, filename) {
  await page.goto(`http://127.0.0.1:${port}/menagerie/scripts/icon-preview.html?variant=${variant}`);
  await page.waitForFunction(() => window.__iconReady === true);
  await page.locator("canvas").screenshot({ path: path.join(output, filename) });
}

let browser;
try {
  await mkdir(output, { recursive: true });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  await render(page, "standard", "icon-1024.png");
  await render(page, "maskable", "icon-maskable-1024.png");

  await copyFile(path.join(output, "icon-1024.png"), path.join(output, "icon-512.png"));
  execFileSync("sips", ["-z", "512", "512", path.join(output, "icon-512.png")], { stdio: "ignore" });
  await copyFile(path.join(output, "icon-1024.png"), path.join(output, "icon-192.png"));
  execFileSync("sips", ["-z", "192", "192", path.join(output, "icon-192.png")], { stdio: "ignore" });
  await copyFile(path.join(output, "icon-1024.png"), path.join(output, "apple-touch-icon.png"));
  execFileSync("sips", ["-z", "180", "180", path.join(output, "apple-touch-icon.png")], { stdio: "ignore" });
  await copyFile(path.join(output, "icon-maskable-1024.png"), path.join(output, "icon-maskable-512.png"));
  execFileSync("sips", ["-z", "512", "512", path.join(output, "icon-maskable-512.png")], { stdio: "ignore" });
  await rm(path.join(output, "icon-maskable-1024.png"));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
