import { webkit } from "playwright";
import fs from "node:fs/promises";

const output = new URL(process.env.TEST_OUTPUT ?? "../tmp/tower-test.json", import.meta.url);
const baseUrl = process.env.TEST_URL ?? "http://127.0.0.1:5173/menagerie/";
const forgiving = process.env.TEST_FORGIVING !== "0";
const strictAnomalies = process.env.TEST_STRICT_ANOMALIES === "1";
const target = Number(process.env.TEST_TOWER_HEIGHT ?? 10);
const thinkTime = Number(process.env.TEST_THINK_MS ?? 1200);
const species = ["tortoise", "capybara", "toucan", "armadillo", "ram", "skunk"];

function shuffledBag(seed) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const sequence = [];
  while (sequence.length < target) {
    const bag = [...species];
    for (let index = bag.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [bag[index], bag[swap]] = [bag[swap], bag[index]];
    }
    sequence.push(...bag);
  }
  return sequence.slice(0, target);
}

const jobs = Array.from({ length: 12 }, (_, index) => ({ seed: index + 1, sequence: shuffledBag(index + 1) }));
const browser = await webkit.launch({ headless: true });
const results = [];

async function worker() {
  while (jobs.length) {
    const job = jobs.shift();
    const page = await browser.newPage({ viewport: { width: 402, height: 714 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const params = new URLSearchParams({ audio: "0", trace: "", diagnostics: "", sequence: job.sequence.join(","), rx: "0" });
      if (!forgiving) params.set("forgiving", "0");
      await page.goto(`${baseUrl}?${params}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => document.querySelector("#game").dataset.heldSpecies);
      for (let turn = 0; turn < target; turn += 1) {
        const beforeScore = Number(await page.locator("#score").textContent());
        const bubble = await page.locator("#rotation-bubble").evaluate((element) => ({ x: Number(element.dataset.centerX), y: Number(element.dataset.centerY) }));
        await page.mouse.click(bubble.x, bubble.y);
        await page.waitForFunction(
          (score) => document.querySelector("#score").classList.contains("lost") || Number(document.querySelector("#score").textContent) > score,
          beforeScore,
          { timeout: 11000 },
        );
        if (await page.locator("#score").evaluate((element) => element.classList.contains("lost"))) break;
        await page.waitForTimeout(thinkTime);
      }
      await page.waitForTimeout(5000);
      await page.evaluate(() => dispatchEvent(new Event("pagehide")));
      const trace = await page.evaluate(() => JSON.parse(sessionStorage.getItem("menagerie-flight-recorder-v1")));
      results.push({
        seed: job.seed,
        sequence: job.sequence,
        score: Number(await page.locator("#score").textContent()),
        lost: await page.locator("#score").evaluate((element) => element.classList.contains("lost")),
        anomalies: trace.events.filter((event) => event.type === "upward_anomaly").length,
        errors,
      });
    } catch (error) {
      results.push({ seed: job.seed, sequence: job.sequence, error: String(error), errors });
    } finally {
      await page.close();
    }
  }
}

await Promise.all([worker(), worker(), worker()]);
await browser.close();
results.sort((left, right) => left.seed - right.seed);
const scores = results.filter((result) => Number.isFinite(result.score)).map((result) => result.score).sort((a, b) => a - b);
const report = {
  forgiving,
  target,
  thinkTime,
  runs: results.length,
  median: scores.length ? (scores[Math.floor((scores.length - 1) / 2)] + scores[Math.ceil((scores.length - 1) / 2)]) / 2 : null,
  reachedEight: scores.filter((score) => score >= 8).length,
  reachedTarget: scores.filter((score) => score >= target).length,
  anomalyCount: results.reduce((sum, result) => sum + (result.anomalies ?? 0), 0),
  errorCount: results.reduce((sum, result) => sum + result.errors.length + (result.error ? 1 : 0), 0),
  results,
};
await fs.mkdir(new URL(".", output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ forgiving, target, median: report.median, reachedEight: report.reachedEight, reachedTarget: report.reachedTarget, anomalyCount: report.anomalyCount, errorCount: report.errorCount }));
if (report.errorCount || (strictAnomalies && report.anomalyCount)) process.exitCode = 1;
