import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readlinkSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const sourceManifestPath = join(repositoryRoot, "audio/sfx-bank.json");
const sourceManifest = JSON.parse(readFileSync(sourceManifestPath, "utf8"));

const options = parseArguments(process.argv.slice(2));
const defaultOutput = join(
  homedir(),
  ".openclaw/playground/audio-generation/menagerie",
  sourceManifest.bankId,
);
const requestedOutput = options.output ?? defaultOutput;

if (!isAbsolute(requestedOutput)) fail("--output must be an absolute directory");
const outputRoot = resolve(requestedOutput);
if (outputRoot === repositoryRoot || outputRoot.startsWith(`${repositoryRoot}/`)) {
  fail("exploratory audio must remain outside the repository");
}

const selectedEvents = sourceManifest.events.filter(
  (event) => !options.event || event.id === options.event,
);
if (selectedEvents.length === 0) fail(`unknown event: ${options.event}`);

const jobs = selectedEvents
  .flatMap((event) => event.seeds.map((seed) => ({ event, seed })))
  .slice(0, options.limit ?? Number.POSITIVE_INFINITY);

if (options.dryRun) {
  console.log(`Bank: ${sourceManifest.bankId}`);
  console.log(`Output: ${outputRoot}`);
  for (const { event, seed } of jobs) {
    console.log(`${event.id} seed=${seed}: ${event.prompt}`);
  }
  process.exit(0);
}

for (const command of ["stable-audio", "ffmpeg", "ffprobe"]) requireCommand(command);

const rawDirectory = join(outputRoot, "raw");
const processedDirectory = join(outputRoot, "processed");
mkdirSync(rawDirectory, { recursive: true });
mkdirSync(processedDirectory, { recursive: true });

const runStartedAt = new Date().toISOString();
const results = [];
for (const [index, job] of jobs.entries()) {
  const stem = `${job.event.id}__seed-${job.seed}`;
  const rawPath = join(rawDirectory, `${stem}.wav`);
  const processedPath = join(processedDirectory, `${stem}.wav`);
  console.log(`\n[${index + 1}/${jobs.length}] ${stem}`);

  if (options.force || !existsSync(rawPath)) generate(job, rawPath);
  else console.log("  raw exists; generation skipped");

  const rawProbe = probeAudio(rawPath);
  const rawSampleStats = inspectPcm16(rawPath);
  if (rawSampleStats.clippedSampleCount > 0) {
    fail(`source contains ${rawSampleStats.clippedSampleCount} clipped samples: ${rawPath}`);
  }
  const processingResult = processAudio(rawPath, processedPath, sourceManifest.processing);
  const processedProbe = probeAudio(processedPath);
  const processedSampleStats = inspectPcm16(processedPath);
  const onsetStats = inspectSecondaryOnsets(
    processedPath,
    processedProbe.durationSeconds,
    sourceManifest.processing,
  );
  validateProbe(processedProbe, sourceManifest.processing);
  if (processedSampleStats.clippedSampleCount > 0) fail(`processed output clips: ${processedPath}`);
  if (processedSampleStats.crestFactor < sourceManifest.processing.minimumCrestFactor) {
    fail(
      `candidate lacks a transient peak (crest ${processedSampleStats.crestFactor.toFixed(2)}): ` +
        processedPath,
    );
  }
  if (onsetStats.secondaryOnsetCount > sourceManifest.processing.maximumSecondaryOnsets) {
    fail(
      `candidate contains ${onsetStats.secondaryOnsetCount} extra onset(s): ${processedPath}`,
    );
  }
  results.push({
    eventId: job.event.id,
    role: job.event.role,
    seed: job.seed,
    prompt: job.event.prompt,
    rawPath,
    processedPath,
    rawProbe,
    rawSampleStats,
    processedProbe,
    processedSampleStats,
    onsetStats,
    processing: processingResult,
  });
  console.log(
    `  validated ${processedProbe.durationSeconds.toFixed(3)}s, ` +
      `${processedProbe.sampleRate} Hz, mono, peak ${processingResult.outputPeakDb.toFixed(1)} dB, ` +
      `crest ${processedSampleStats.crestFactor.toFixed(1)}, ` +
      `zero crossings ${processedSampleStats.zeroCrossingRate.toFixed(3)}, ` +
      `${onsetStats.secondaryOnsetCount} extra onsets`,
  );
}

const runManifest = {
  schemaVersion: 1,
  bankId: sourceManifest.bankId,
  status: "exploratory-unreviewed",
  sourceManifestPath,
  sourceManifest,
  runStartedAt,
  runCompletedAt: new Date().toISOString(),
  sourceRevision: gitRevision(),
  sourceDirty: gitDirty(),
  stableAudioRevision: stableAudioRevision(),
  modelWeightsRevision: modelWeightsRevision(),
  outputRoot,
  results,
};
writeFileSync(join(outputRoot, "run-manifest.json"), `${JSON.stringify(runManifest, null, 2)}\n`);
writeFileSync(join(outputRoot, "audition.html"), renderAuditionPage(runManifest));

console.log(`\nGenerated ${results.length} candidates.`);
console.log(`Manifest: ${join(outputRoot, "run-manifest.json")}`);
console.log(`Audition: ${join(outputRoot, "audition.html")}`);

function parseArguments(argumentsList) {
  const parsed = { dryRun: false, force: false, event: null, limit: null, output: null };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--dry-run") parsed.dryRun = true;
    else if (argument === "--force") parsed.force = true;
    else if (argument === "--event") parsed.event = requireValue(argumentsList, ++index, argument);
    else if (argument === "--limit") parsed.limit = Number.parseInt(requireValue(argumentsList, ++index, argument), 10);
    else if (argument === "--output") parsed.output = requireValue(argumentsList, ++index, argument);
    else fail(`unknown argument: ${argument}`);
  }
  if (parsed.limit !== null && (!Number.isInteger(parsed.limit) || parsed.limit < 1)) {
    fail("--limit must be a positive integer");
  }
  return parsed;
}

function requireValue(argumentsList, index, flag) {
  const value = argumentsList[index];
  if (!value || value.startsWith("--")) fail(`${flag} requires a value`);
  return value;
}

function requireCommand(command) {
  const result = spawnSync("/usr/bin/env", ["sh", "-c", `command -v ${command}`], {
    encoding: "utf8",
  });
  if (result.status !== 0) fail(`required command not found: ${command}`);
}

function generate(job, rawPath) {
  const model = sourceManifest.model;
  const argumentsList = [
    "--dit", model.dit,
    "--decoder", model.decoder,
    "--prompt", job.event.prompt,
    "--cfg", String(model.cfg),
    "--steps", String(model.steps),
    "--seconds", String(model.durationSeconds),
    "--seed", String(job.seed),
    "--out", rawPath,
  ];
  if (model.negativePrompt) argumentsList.splice(6, 0, "--negative-prompt", model.negativePrompt);
  run("stable-audio", argumentsList);
}

function processAudio(rawPath, processedPath, processing) {
  const temporaryPath = `${processedPath}.trim.wav`;
  rmSync(temporaryPath, { force: true });
  const trimFilter = [
    "pan=mono|c0=c0",
    `silenceremove=start_periods=1:start_duration=0:start_threshold=${processing.onsetThresholdDb}dB` +
      `:start_mode=any:detection=${processing.silenceDetection}:window=${processing.detectionWindowSeconds}` +
      `:stop_periods=1:stop_duration=${processing.trailingSilenceSeconds}` +
      `:stop_threshold=${processing.silenceThresholdDb}dB`,
    `atrim=duration=${processing.maximumDurationSeconds}`,
    "afade=t=in:st=0:d=0.002",
  ].join(",");
  run("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error", "-i", rawPath,
    "-af", trimFilter,
    "-ar", String(processing.sampleRate), "-ac", String(processing.channels),
    "-c:a", processing.codec, temporaryPath,
  ]);

  let trimmedProbe;
  try {
    trimmedProbe = probeAudio(temporaryPath);
  } catch {
    trimmedProbe = null;
  }
  if (!trimmedProbe || trimmedProbe.durationSeconds < 0.04) {
    fail(`no isolated transient found: ${rawPath}`);
  }
  if (trimmedProbe.durationSeconds > processing.maximumAcceptedDurationSeconds) {
    fail(`transient did not decay naturally: ${rawPath}`);
  }

  const inputPeakDb = measurePeakDb(temporaryPath);
  if (!Number.isFinite(inputPeakDb) || inputPeakDb < -80) fail(`silent candidate: ${rawPath}`);
  const gainDb = processing.targetPeakDb - inputPeakDb;
  const finalTemporaryPath = `${processedPath}.new.wav`;
  rmSync(finalTemporaryPath, { force: true });
  run("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error", "-i", temporaryPath,
    "-af", `volume=${gainDb.toFixed(3)}dB`,
    "-ar", String(processing.sampleRate), "-ac", String(processing.channels),
    "-c:a", processing.codec, finalTemporaryPath,
  ]);
  renameSync(finalTemporaryPath, processedPath);
  rmSync(temporaryPath, { force: true });

  return {
    inputPeakDb,
    appliedGainDb: gainDb,
    outputPeakDb: measurePeakDb(processedPath),
    silenceTrimmed: true,
    rawPreserved: true,
  };
}

function probeAudio(path) {
  const output = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "a:0",
    "-show_entries", "stream=codec_name,sample_rate,channels:format=duration,size",
    "-of", "json", path,
  ], { encoding: "utf8" });
  const data = JSON.parse(output);
  const stream = data.streams?.[0];
  if (!stream) throw new Error(`no audio stream: ${path}`);
  return {
    codec: stream.codec_name,
    sampleRate: Number(stream.sample_rate),
    channels: Number(stream.channels),
    durationSeconds: Number(data.format.duration),
    sizeBytes: Number(data.format.size),
  };
}

function measurePeakDb(path) {
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-nostats", "-i", path, "-af", "volumedetect", "-f", "null", "-",
  ], { encoding: "utf8" });
  const match = `${result.stdout}\n${result.stderr}`.match(/max_volume:\s*(-?[\d.]+) dB/);
  if (!match) fail(`could not measure peak: ${path}`);
  return Number(match[1]);
}

function inspectSecondaryOnsets(path, durationSeconds, processing) {
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-nostats", "-i", path,
    "-af",
    `silencedetect=n=${processing.secondaryOnsetSilenceThresholdDb}dB:` +
      `d=${processing.minimumInterOnsetSilenceSeconds}`,
    "-f", "null", "-",
  ], { encoding: "utf8" });
  if (result.status !== 0) fail(`could not inspect onsets: ${path}`);

  const log = `${result.stdout}\n${result.stderr}`;
  const silenceEnds = [...log.matchAll(/silence_end:\s*([\d.]+)/g)]
    .map((match) => Number(match[1]));
  const endToleranceSeconds = 0.005;
  const secondaryOnsetTimesSeconds = silenceEnds.filter(
    (time) => time < durationSeconds - endToleranceSeconds,
  );
  return {
    silenceThresholdDb: processing.secondaryOnsetSilenceThresholdDb,
    minimumSilenceSeconds: processing.minimumInterOnsetSilenceSeconds,
    secondaryOnsetCount: secondaryOnsetTimesSeconds.length,
    secondaryOnsetTimesSeconds,
  };
}

function inspectPcm16(path) {
  const wav = readFileSync(path);
  if (wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
    fail(`not a RIFF/WAVE file: ${path}`);
  }
  let format = null;
  let dataOffset = null;
  let dataSize = null;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const chunkId = wav.toString("ascii", offset, offset + 4);
    const chunkSize = wav.readUInt32LE(offset + 4);
    const payloadOffset = offset + 8;
    if (chunkId === "fmt ") {
      format = {
        audioFormat: wav.readUInt16LE(payloadOffset),
        channels: wav.readUInt16LE(payloadOffset + 2),
        sampleRate: wav.readUInt32LE(payloadOffset + 4),
        bitsPerSample: wav.readUInt16LE(payloadOffset + 14),
      };
    } else if (chunkId === "data") {
      dataOffset = payloadOffset;
      dataSize = Math.min(chunkSize, wav.length - payloadOffset);
      break;
    }
    offset = payloadOffset + chunkSize + (chunkSize % 2);
  }
  if (!format || format.audioFormat !== 1 || format.bitsPerSample !== 16 || dataOffset === null) {
    fail(`expected PCM16 WAV: ${path}`);
  }
  let peakSample = 0;
  let clippedSampleCount = 0;
  let nonZeroSampleCount = 0;
  let zeroCrossingCount = 0;
  let previousSample = 0;
  let sumSquares = 0;
  const sampleCount = Math.floor(dataSize / 2);
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = wav.readInt16LE(dataOffset + index * 2);
    const magnitude = Math.abs(sample);
    peakSample = Math.max(peakSample, magnitude);
    if (magnitude >= 32767) clippedSampleCount += 1;
    if (sample !== 0) nonZeroSampleCount += 1;
    if (previousSample !== 0 && sample !== 0 && Math.sign(previousSample) !== Math.sign(sample)) {
      zeroCrossingCount += 1;
    }
    previousSample = sample;
    const normalized = sample / 32768;
    sumSquares += normalized * normalized;
  }
  if (sampleCount === 0 || nonZeroSampleCount === 0) fail(`silent PCM data: ${path}`);
  const rmsLinear = Math.sqrt(sumSquares / sampleCount);
  const peakLinear = peakSample / 32768;
  return {
    sampleCount,
    nonZeroSampleCount,
    clippedSampleCount,
    peakSample,
    peakLinear,
    rmsLinear,
    crestFactor: peakLinear / rmsLinear,
    zeroCrossingRate: zeroCrossingCount / sampleCount,
  };
}

function validateProbe(probe, processing) {
  if (probe.codec !== processing.codec) fail(`unexpected codec: ${probe.codec}`);
  if (probe.sampleRate !== processing.sampleRate) fail(`unexpected sample rate: ${probe.sampleRate}`);
  if (probe.channels !== processing.channels) fail(`unexpected channel count: ${probe.channels}`);
  if (!Number.isFinite(probe.durationSeconds) || probe.durationSeconds < 0.04) fail("invalid duration");
  if (probe.durationSeconds > processing.maximumDurationSeconds + 0.01) fail("processed file is too long");
  if (!Number.isFinite(probe.sizeBytes) || probe.sizeBytes <= 44) fail("invalid WAV size");
}

function gitRevision() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
}

function gitDirty() {
  return execFileSync("git", ["status", "--porcelain"], { cwd: repositoryRoot, encoding: "utf8" }).trim().length > 0;
}

function stableAudioRevision() {
  const checkout = join(homedir(), ".openclaw/git/stable-audio-3");
  if (!existsSync(join(checkout, ".git"))) return null;
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: checkout, encoding: "utf8" }).trim();
}

function modelWeightsRevision() {
  const weights = join(
    homedir(),
    ".openclaw/git/stable-audio-3/optimized/mlx/models/mlx/dit_sm-sfx_f16.npz",
  );
  if (!existsSync(weights)) return null;
  try {
    const match = readlinkSync(weights).match(/\/snapshots\/([^/]+)\//);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function renderAuditionPage(runManifest) {
  const groups = sourceManifest.events.map((event) => {
    const candidates = runManifest.results.filter((result) => result.eventId === event.id);
    const players = candidates.map((candidate) => {
      const relativePath = `processed/${candidate.processedPath.split("/").at(-1)}`;
      return `<article><strong>Seed ${candidate.seed}</strong><audio controls preload="metadata" src="${relativePath}"></audio><small>${candidate.processedProbe.durationSeconds.toFixed(3)} s</small></article>`;
    }).join("\n");
    return `<section><h2>${event.id}</h2><p>${event.role}</p><div class="grid">${players}</div></section>`;
  }).join("\n");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${sourceManifest.bankId}</title><style>body{font:16px system-ui;max-width:920px;margin:40px auto;padding:0 20px;background:#eef5ee;color:#153f3b}h1,h2{font-weight:500}section{margin:32px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}article{background:#fff9;padding:14px;border-radius:14px}audio{display:block;width:100%;margin:10px 0}small{opacity:.65}</style><h1>${sourceManifest.bankId}</h1><p>Exploratory Stable Audio candidates. Technical validation is complete; artistic selection is not.</p>${groups}</html>\n`;
}

function run(command, argumentsList) {
  const result = spawnSync(command, argumentsList, { stdio: "inherit" });
  if (result.status !== 0) fail(`${command} exited with status ${result.status}`);
}

function fail(message) {
  console.error(`audio pipeline: ${message}`);
  process.exit(1);
}
