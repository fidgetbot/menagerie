import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const targetRoot = join(repositoryRoot, "public/audio/audition");
const sourceRoot = parseSource(process.argv.slice(2));
const sourceManifestPath = join(sourceRoot, "run-manifest.json");

if (!existsSync(sourceManifestPath)) fail(`missing run manifest: ${sourceManifestPath}`);
const runManifest = JSON.parse(readFileSync(sourceManifestPath, "utf8"));
if (runManifest.status !== "exploratory-unreviewed") {
  fail(`unexpected audition status: ${runManifest.status}`);
}
if (!Array.isArray(runManifest.results) || runManifest.results.length === 0) {
  fail("run manifest contains no candidates");
}

rmSync(targetRoot, { recursive: true, force: true });
const processedDirectory = join(targetRoot, "processed");
mkdirSync(processedDirectory, { recursive: true });

const publishedResults = runManifest.results.map((result) => {
  if (result.onsetStats?.secondaryOnsetCount !== 0) {
    fail(`refusing candidate with extra onsets: ${result.processedPath}`);
  }
  const filename = basename(result.processedPath);
  const publishedPath = join(processedDirectory, filename);
  copyFileSync(result.processedPath, publishedPath);
  return {
    ...result,
    rawPath: undefined,
    processedPath: `processed/${filename}`,
  };
});

const publicManifest = {
  ...runManifest,
  sourceManifestPath: relative(repositoryRoot, runManifest.sourceManifestPath),
  outputRoot: undefined,
  rawMasters: "Preserved outside the repository in the local generation archive.",
  results: publishedResults,
};

writeFileSync(
  join(targetRoot, "run-manifest.json"),
  `${JSON.stringify(publicManifest, null, 2)}\n`,
);
writeFileSync(join(targetRoot, "audition.html"), renderAuditionPage(publicManifest));

console.log(`Published ${publishedResults.length} candidates to ${targetRoot}`);

function parseSource(argumentsList) {
  const index = argumentsList.indexOf("--source");
  if (index < 0 || !argumentsList[index + 1]) fail("--source ABSOLUTE_DIRECTORY is required");
  const source = argumentsList[index + 1];
  if (!isAbsolute(source)) fail("--source must be an absolute directory");
  return resolve(source);
}

function renderAuditionPage(manifest) {
  const currentReferences = [
    {
      label: "Current settling tick",
      detail: "Seed 142001 · shipped bank",
      src: "../ceramic/settling_tick__seed-142001.wav",
    },
    {
      label: "Current body contact",
      detail: "Seed 142103 · shipped bank",
      src: "../ceramic/body_contact__seed-142103.wav",
    },
  ];
  const referenceCards = currentReferences.map(renderCard).join("\n");
  const groups = manifest.sourceManifest.events.map((event) => {
    const candidates = manifest.results.filter((result) => result.eventId === event.id);
    const cards = candidates.map((candidate) => renderCard({
      label: `Seed ${candidate.seed}`,
      detail: `${Math.round(candidate.processedProbe.durationSeconds * 1000)} ms · −4.5 dB peak`,
      src: candidate.processedPath,
    })).join("\n");
    return `<section data-group>
      <header><div><h2>${escapeHtml(titleCase(event.id))}</h2><p>${escapeHtml(event.role)}</p></div><button type="button" data-play-group>Play group</button></header>
      <div class="grid">${cards}</div>
    </section>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Menagerie sound audition · ${escapeHtml(manifest.bankId)}</title>
  <style>
    :root{color-scheme:light;--ink:#163e3b;--muted:#58716e;--paper:#f4f1e6;--card:#fffdf7;--accent:#d8764b;--line:#d8ded4}
    *{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,#e6f0e8,var(--paper) 45%);color:var(--ink);font:16px/1.45 system-ui,-apple-system,sans-serif}
    main{max-width:980px;margin:auto;padding:34px 18px 64px}h1{font-size:clamp(2rem,7vw,3.7rem);line-height:1;margin:.25em 0;font-weight:650;letter-spacing:-.04em}h2{margin:0;font-size:1.35rem}p{color:var(--muted);max-width:720px}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:.75rem;font-weight:750;color:var(--accent)}
    .notice{background:#fff8;border:1px solid var(--line);border-radius:18px;padding:14px 16px;margin:24px 0}section{margin-top:34px}section header{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:12px}section header p{margin:.25rem 0 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:12px}.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:15px;box-shadow:0 8px 30px #3452 0}.card strong,.card small{display:block}.card small{color:var(--muted);margin-top:2px}.card audio{display:block;width:100%;margin-top:12px;height:36px}
    button{appearance:none;border:1px solid #b95f3a;background:#fff8f1;color:#8b3e22;border-radius:999px;padding:8px 13px;font:inherit;font-weight:650;white-space:nowrap}button:active{transform:translateY(1px)}footer{margin-top:42px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:.86rem}a{color:inherit}
    @media(max-width:520px){main{padding-top:24px}section header{align-items:start}button{font-size:.88rem}}
  </style>
</head>
<body><main>
  <div class="eyebrow">Audition only · September 2026</div>
  <h1>What should Menagerie sound like?</h1>
  <p>Ten technically validated, single-contact candidates generated from three ceramic material directions. Use headphones if possible, and listen to each group more than once—the game rotates several variants to keep repeated contacts from sounding mechanical.</p>
  <div class="notice"><strong>No gameplay audio has changed.</strong> This page contains normalized audition previews only. Untouched stereo masters remain in the local generation archive.</div>
  <section data-group>
    <header><div><h2>Current game</h2><p>Reference sounds from the bank that is live today.</p></div><button type="button" data-play-group>Play group</button></header>
    <div class="grid">${referenceCards}</div>
  </section>
  ${groups}
  <footer>Generated with <a href="https://huggingface.co/stabilityai/stable-audio-3-small-sfx">Stable Audio 3 Small SFX</a>. Generated WAV outputs only; no model weights are distributed. See the <a href="https://stability.ai/community-license-agreement">Community License</a>, <a href="https://stability.ai/use-policy">Acceptable Use Policy</a>, and <a href="run-manifest.json">generation manifest</a>.</footer>
</main>
<script>
  let activeAudio = null;
  function stopAll(){document.querySelectorAll('audio').forEach(audio=>{audio.pause();audio.currentTime=0});activeAudio=null}
  document.querySelectorAll('audio').forEach(audio=>audio.addEventListener('play',()=>{if(activeAudio&&activeAudio!==audio){activeAudio.pause();activeAudio.currentTime=0}activeAudio=audio}));
  document.querySelectorAll('[data-play-group]').forEach(button=>button.addEventListener('click',async()=>{stopAll();const players=[...button.closest('[data-group]').querySelectorAll('audio')];button.disabled=true;for(const player of players){await player.play();await new Promise(resolve=>player.addEventListener('ended',resolve,{once:true}));await new Promise(resolve=>setTimeout(resolve,140))}button.disabled=false}));
</script></body></html>\n`;
}

function renderCard({ label, detail, src }) {
  return `<article class="card"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small><audio controls preload="metadata" src="${escapeHtml(src)}"></audio></article>`;
}

function titleCase(value) {
  return value.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;",
  })[character]);
}

function fail(message) {
  console.error(`audio publisher: ${message}`);
  process.exit(1);
}
